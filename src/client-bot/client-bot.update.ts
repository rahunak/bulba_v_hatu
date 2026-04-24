import { Update, Start, Command, On, InjectBot, Action } from 'nestjs-telegraf';
import { Telegraf, Markup } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import type { BotContext } from '../common/interfaces/bot-context.interface';
import { ClientBotService } from './client-bot.service';
import { AdminBotService } from '../admin-bot/admin-bot.service';
import { Logger } from '@nestjs/common';

@Update()
export class ClientBotUpdate {
  private readonly logger = new Logger(ClientBotUpdate.name);

  constructor(
    @InjectBot('client')
    private readonly bot: Telegraf<BotContext>,
    private readonly prisma: PrismaService,
    private readonly clientBotService: ClientBotService,
    private readonly adminBotService: AdminBotService,
  ) {}

  @Start()
  async onStart(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    this.logger.log(`[START] User ${telegramId} (${ctx.from?.username}) started the bot`);

    if (!telegramId) return;

    let user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      this.logger.log(`[REGISTER] Creating new user: ${telegramId} (${ctx.from?.username})`);
      user = await this.prisma.user.create({
        data: {
          telegramId,
          username: ctx.from?.username,
          role: 'CLIENT',
        },
      });
      this.logger.log(`[REGISTER] User created successfully: ${user.id}`);
    } else {
      this.logger.log(`[START] Existing user: ${user.id} (${user.username})`);
    }

    ctx.session.cart = [];

    await ctx.reply(
      '🥬 Добро пожаловать в магазин овощей!\n\nВыберите действие:',
      Markup.keyboard([
        ['📦 Каталог товаров'],
        ['🛒 Моя корзина', '📋 Мои заказы'],
      ]).resize(),
    );
  }

  @On('text')
  async onText(ctx: BotContext): Promise<void> {
    const text = (ctx.message as { text: string }).text;
    const telegramId = ctx.from?.id.toString();
    this.logger.log(`[TEXT] User ${telegramId} sent: "${text}"`);

    if (text === '📦 Каталог товаров') {
      this.logger.log(`[CATALOG] User ${telegramId} opened catalog`);
      await this.showCatalog(ctx);
    } else if (text === '🛒 Моя корзина') {
      this.logger.log(`[CART] User ${telegramId} opened cart`);
      await this.showCart(ctx);
    } else if (text === '📋 Мои заказы') {
      this.logger.log(`[ORDERS] User ${telegramId} opened orders`);
      await this.showOrders(ctx);
    } else if (ctx.session.orderStep === 'awaiting_phone') {
      this.logger.log(`[PHONE] User ${telegramId} provided phone as text: ${text}`);
      await this.handlePhoneText(ctx, text);
    } else if (ctx.session.orderStep === 'awaiting_address') {
      this.logger.log(`[ADDRESS] User ${telegramId} provided address: ${text}`);
      await this.handleAddress(ctx, text);
    }
  }

  @On('contact')
  async onContact(ctx: BotContext): Promise<void> {
    const contact = (ctx.message as { contact: { phone_number: string } }).contact;
    const telegramId = ctx.from?.id.toString();
    this.logger.log(`[CONTACT] User ${telegramId} shared phone: ${contact.phone_number}`);

    ctx.session.phone = contact.phone_number;

    if (telegramId) {
      await this.prisma.user.update({
        where: { telegramId },
        data: { phone: contact.phone_number },
      });
      this.logger.log(`[CONTACT] Phone saved for user ${telegramId}`);
    }

    ctx.session.orderStep = 'awaiting_address';
    await ctx.reply(
      '📍 Отлично! Теперь введите адрес доставки в Минске:',
      Markup.removeKeyboard(),
    );
  }

  private async showCatalog(ctx: BotContext): Promise<void> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
    });

    this.logger.log(`[CATALOG] Found ${products.length} active products`);

    if (products.length === 0) {
      await ctx.reply('К сожалению, товары временно отсутствуют.');
      return;
    }

    const cart = ctx.session.cart || [];

    for (const product of products) {
      const cartItem = cart.find((item) => item.productId === product.id);

      let buttons;
      let text = `${product.name}\n💰 Цена: ${product.price} BYN\n📦 В наличии: ${product.stock} шт.`;

      if (cartItem) {
        const itemTotal = Number(product.price) * cartItem.quantity;
        text += `\n🛒 В корзине: ${cartItem.quantity} шт.`;
        text += `\n💵 Сумма: ${itemTotal.toFixed(2)} BYN`;

        // Показываем предупреждение, если достигнут максимум
        if (cartItem.quantity >= product.stock) {
          text += `\n⚠️ Максимум достигнут`;
          // Убираем кнопку +, оставляем только - и количество
          buttons = Markup.inlineKeyboard([
            [
              Markup.button.callback('➖', `remove_${product.id}`),
              Markup.button.callback(`${cartItem.quantity} шт`, `quantity_${product.id}`),
            ],
          ]);
        } else {
          buttons = Markup.inlineKeyboard([
            [
              Markup.button.callback('➖', `remove_${product.id}`),
              Markup.button.callback(`${cartItem.quantity} шт`, `quantity_${product.id}`),
              Markup.button.callback('➕', `add_${product.id}`),
            ],
          ]);
        }
      } else {
        buttons = Markup.inlineKeyboard([
          Markup.button.callback('➕ Добавить в корзину', `add_${product.id}`),
        ]);
      }

      if (product.photoId) {
        await ctx.replyWithPhoto(product.photoId, { caption: text, ...buttons });
      } else {
        await ctx.reply(text, buttons);
      }
    }
  }

  private async showCart(ctx: BotContext): Promise<void> {
    const cart = ctx.session.cart || [];

    if (cart.length === 0) {
      await ctx.reply('🛒 Ваша корзина пуста.');
      return;
    }

    let total = 0;
    let cartText = '🛒 Ваша корзина:\n\n';

    for (const item of cart) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (product) {
        const itemTotal = Number(product.price) * item.quantity;
        total += itemTotal;
        cartText += `${product.name} x${item.quantity} = ${itemTotal.toFixed(2)} BYN\n`;
      }
    }

    cartText += `\n💰 Итого: ${total.toFixed(2)} BYN`;

    await ctx.reply(
      cartText,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Оформить заказ', 'checkout')],
        [Markup.button.callback('🗑 Очистить корзину', 'clear_cart')],
      ]),
    );
  }

  private async showOrders(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            orderItems: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.orders.length === 0) {
      await ctx.reply('У вас пока нет заказов.');
      return;
    }

    let ordersText = '📋 Ваши последние заказы:\n\n';

    for (const order of user.orders) {
      const statusEmoji = {
        PENDING: '⏳',
        ACCEPTED: '✅',
        COMPLETED: '🎉',
        CANCELLED: '❌',
      }[order.status];

      ordersText += `${statusEmoji} Заказ #${order.id.slice(0, 8)}\n`;
      ordersText += `Дата: ${order.createdAt.toLocaleDateString('ru-RU')}\n`;
      ordersText += `Статус: ${order.status}\n`;
      ordersText += `📍 Адрес: ${order.address}\n\n`;

      ordersText += `📦 Товары:\n`;
      for (const item of order.orderItems) {
        ordersText += `  • ${item.product.name} x${item.quantity} = ${(Number(item.price) * item.quantity).toFixed(2)} BYN\n`;
      }

      ordersText += `\n💰 Итого: ${order.totalAmount} BYN\n\n`;
      ordersText += '─────────────────\n\n';
    }

    await ctx.reply(ordersText);
  }

  private async handleAddress(ctx: BotContext, address: string): Promise<void> {
    const telegramId = ctx.from?.id.toString();

    // Проверяем, хочет ли пользователь отменить заказ
    if (address === '❌ Отменить заказ') {
      this.logger.log(`[ORDER_CANCEL] User ${telegramId} cancelled order`);
      delete ctx.session.orderStep;
      delete ctx.session.phone;
      delete ctx.session.address;
      await ctx.reply(
        '❌ Оформление заказа отменено.',
        Markup.keyboard([
          ['📦 Каталог товаров'],
          ['🛒 Моя корзина', '📋 Мои заказы'],
        ]).resize(),
      );
      return;
    }

    // Валидация адреса (минимум 10 символов)
    if (address.trim().length < 10) {
      this.logger.warn(`[ADDRESS] User ${telegramId} entered too short address: ${address}`);
      await ctx.reply(
        '❌ Адрес слишком короткий.\n\n' +
        'Пожалуйста, введите полный адрес доставки (улица, дом, квартира).\n' +
        'Например: ул. Ленина, д. 10, кв. 5',
        Markup.keyboard([['❌ Отменить заказ']]).resize(),
      );
      return;
    }

    this.logger.log(`[ORDER] User ${telegramId} creating order with address: ${address}`);

    ctx.session.address = address;
    ctx.session.orderStep = undefined;

    const cart = ctx.session.cart || [];

    if (!telegramId || cart.length === 0) {
      this.logger.warn(`[ORDER] Order creation failed for user ${telegramId}: empty cart or no telegramId`);
      await ctx.reply('Ошибка при оформлении заказа.');
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      this.logger.error(`[ORDER] User ${telegramId} not found in database`);
      await ctx.reply('Пользователь не найден.');
      return;
    }

    try {
      let totalAmount = 0;
      const orderItems: Array<{ productId: string; quantity: number; price: any }> = [];

      for (const item of cart) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || product.stock < item.quantity) {
          this.logger.warn(`[ORDER] Product ${product?.id} unavailable or insufficient stock for user ${telegramId}`);
          await ctx.reply(`Товар ${product?.name || 'неизвестен'} недоступен в нужном количестве.`);
          return;
        }

        const itemPrice = Number(product.price) * item.quantity;
        totalAmount += itemPrice;

        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.price,
        });
      }

      this.logger.log(`[ORDER] Creating order for user ${telegramId}, total: ${totalAmount} BYN, items: ${orderItems.length}`);

      const order = await this.prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            userId: user.id,
            address,
            totalAmount,
            status: 'PENDING',
            orderItems: {
              create: orderItems,
            },
          },
        });

        for (const item of cart) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });
        }

        return newOrder;
      });

      this.logger.log(`[ORDER] Order ${order.id} created successfully for user ${telegramId}`);

      ctx.session.cart = [];

      await this.clientBotService.sendOrderConfirmation(ctx.chat!.id, order.id);
      await this.adminBotService.notifyNewOrder(order.id);

      this.logger.log(`[ORDER] Notifications sent for order ${order.id}`);

      await ctx.reply(
        '🏠 Вернуться в главное меню',
        Markup.keyboard([
          ['📦 Каталог товаров'],
          ['🛒 Моя корзина', '📋 Мои заказы'],
        ]).resize(),
      );
    } catch (error) {
      this.logger.error(`[ORDER] Order creation failed for user ${telegramId}:`, error);
      await ctx.reply('Произошла ошибка при оформлении заказа. Попробуйте позже.');
    }
  }

  @Action(/^add_/)
  async onAddToCart(ctx: BotContext): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const productId = callbackQuery.data.replace('add_', '');
    const telegramId = ctx.from?.id.toString();

    // Получаем информацию о товаре для проверки остатка
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      await ctx.answerCbQuery('❌ Товар не найден');
      return;
    }

    ctx.session.cart = ctx.session.cart || [];

    const existingItem = ctx.session.cart.find((item) => item.productId === productId);
    const currentQuantity = existingItem ? existingItem.quantity : 0;

    // Проверяем, не превышает ли новое количество остаток на складе
    if (currentQuantity >= product.stock) {
      this.logger.warn(`[CART] User ${telegramId} tried to add more than available stock for product ${productId}`);
      await ctx.answerCbQuery(`⚠️ Достигнут максимум! В наличии только ${product.stock} шт.`, { show_alert: true });
      return;
    }

    if (existingItem) {
      existingItem.quantity += 1;
      this.logger.log(`[CART] User ${telegramId} increased product ${productId} quantity to ${existingItem.quantity}`);
    } else {
      ctx.session.cart.push({ productId, quantity: 1 });
      this.logger.log(`[CART] User ${telegramId} added product ${productId} to cart`);
    }

    await ctx.answerCbQuery('✅ Товар добавлен в корзину');

    // Update the message with new buttons
    if ('message' in callbackQuery) {
      const cartItem = ctx.session.cart.find((item) => item.productId === productId);
      let text = `${product.name}\n💰 Цена: ${product.price} BYN\n📦 В наличии: ${product.stock} шт.`;

      if (cartItem) {
        const itemTotal = Number(product.price) * cartItem.quantity;
        text += `\n🛒 В корзине: ${cartItem.quantity} шт.`;
        text += `\n💵 Сумма: ${itemTotal.toFixed(2)} BYN`;

        // Показываем предупреждение, если достигнут максимум
        if (cartItem.quantity >= product.stock) {
          text += `\n⚠️ Максимум достигнут`;
        }
      }

      // Убираем кнопку +, если достигнут максимум
      let buttons;
      if (cartItem && cartItem.quantity >= product.stock) {
        buttons = Markup.inlineKeyboard([
          [
            Markup.button.callback('➖', `remove_${product.id}`),
            Markup.button.callback(`${cartItem.quantity} шт`, `quantity_${product.id}`),
          ],
        ]);
      } else {
        buttons = Markup.inlineKeyboard([
          [
            Markup.button.callback('➖', `remove_${product.id}`),
            Markup.button.callback(`${cartItem?.quantity || 0} шт`, `quantity_${product.id}`),
            Markup.button.callback('➕', `add_${product.id}`),
          ],
        ]);
      }

      try {
        if (product.photoId) {
          await ctx.editMessageCaption(text, buttons);
        } else {
          await ctx.editMessageText(text, buttons);
        }
      } catch (error) {
        // Message might be too old to edit
      }
    }
  }

  @Action(/^remove_/)
  async onRemoveFromCart(ctx: BotContext): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const productId = callbackQuery.data.replace('remove_', '');
    const telegramId = ctx.from?.id.toString();

    ctx.session.cart = ctx.session.cart || [];

    const existingItem = ctx.session.cart.find((item) => item.productId === productId);

    if (existingItem) {
      if (existingItem.quantity > 1) {
        existingItem.quantity -= 1;
        this.logger.log(`[CART] User ${telegramId} decreased product ${productId} quantity to ${existingItem.quantity}`);
      } else {
        ctx.session.cart = ctx.session.cart.filter((item) => item.productId !== productId);
        this.logger.log(`[CART] User ${telegramId} removed product ${productId} from cart`);
      }
    }

    await ctx.answerCbQuery('✅ Товар удален из корзины');

    // Update the message with new buttons
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (product && 'message' in callbackQuery) {
      const cartItem = ctx.session.cart.find((item) => item.productId === productId);
      let text = `${product.name}\n💰 Цена: ${product.price} BYN\n📦 В наличии: ${product.stock} шт.`;

      let buttons;
      if (cartItem) {
        const itemTotal = Number(product.price) * cartItem.quantity;
        text += `\n🛒 В корзине: ${cartItem.quantity} шт.`;
        text += `\n💵 Сумма: ${itemTotal.toFixed(2)} BYN`;

        // Показываем предупреждение, если достигнут максимум
        if (cartItem.quantity >= product.stock) {
          text += `\n⚠️ Максимум достигнут`;
          // Убираем кнопку +, если достигнут максимум
          buttons = Markup.inlineKeyboard([
            [
              Markup.button.callback('➖', `remove_${product.id}`),
              Markup.button.callback(`${cartItem.quantity} шт`, `quantity_${product.id}`),
            ],
          ]);
        } else {
          // Показываем кнопку +, если еще есть товар на складе
          buttons = Markup.inlineKeyboard([
            [
              Markup.button.callback('➖', `remove_${product.id}`),
              Markup.button.callback(`${cartItem.quantity} шт`, `quantity_${product.id}`),
              Markup.button.callback('➕', `add_${product.id}`),
            ],
          ]);
        }
      } else {
        buttons = Markup.inlineKeyboard([
          Markup.button.callback('➕ Добавить в корзину', `add_${product.id}`),
        ]);
      }

      try {
        if (product.photoId) {
          await ctx.editMessageCaption(text, buttons);
        } else {
          await ctx.editMessageText(text, buttons);
        }
      } catch (error) {
        // Message might be too old to edit
      }
    }
  }

  @Action('checkout')
  async onCheckout(ctx: BotContext): Promise<void> {
    const cart = ctx.session.cart || [];

    if (cart.length === 0) {
      await ctx.answerCbQuery('Корзина пуста');
      return;
    }

    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user?.phone) {
      ctx.session.orderStep = 'awaiting_phone';
      await ctx.reply(
        '📞 Для оформления заказа нам нужен ваш номер телефона.\n\n' +
        'Вы можете:\n' +
        '• Поделиться номером через кнопку ниже\n' +
        '• Ввести номер вручную (например: +375291234567)',
        Markup.keyboard([
          [Markup.button.contactRequest('📱 Отправить номер')],
          ['❌ Отменить заказ'],
        ]).resize(),
      );
    } else {
      ctx.session.orderStep = 'awaiting_address';
      await ctx.reply(
        '📍 Введите адрес доставки в Минске:',
        Markup.keyboard([['❌ Отменить заказ']]).resize(),
      );
    }

    await ctx.answerCbQuery();
  }

  @Action('clear_cart')
  async onClearCart(ctx: BotContext): Promise<void> {
    ctx.session.cart = [];
    await ctx.answerCbQuery('🗑 Корзина очищена');
    await ctx.editMessageText('🛒 Корзина очищена.');
  }

  private async handlePhoneText(ctx: BotContext, text: string): Promise<void> {
    const telegramId = ctx.from?.id.toString();

    // Проверяем, хочет ли пользователь отменить заказ
    if (text === '❌ Отменить заказ') {
      this.logger.log(`[ORDER_CANCEL] User ${telegramId} cancelled order`);
      delete ctx.session.orderStep;
      delete ctx.session.phone;
      delete ctx.session.address;
      await ctx.reply(
        '❌ Оформление заказа отменено.',
        Markup.keyboard([
          ['📦 Каталог товаров'],
          ['🛒 Моя корзина', '📋 Мои заказы'],
        ]).resize(),
      );
      return;
    }

    // Валидация номера телефона
    // Убираем все пробелы, дефисы и скобки
    const cleanPhone = text.replace(/[\s\-\(\)]/g, '');

    // Проверяем формат: должен начинаться с + и содержать 10-15 цифр
    const phoneRegex = /^\+?\d{10,15}$/;

    if (!phoneRegex.test(cleanPhone)) {
      this.logger.warn(`[PHONE] User ${telegramId} entered invalid phone format: ${text}`);
      await ctx.reply(
        '❌ Неверный формат номера телефона.\n\n' +
        'Пожалуйста, введите номер в формате:\n' +
        '+375291234567 или 375291234567\n\n' +
        'Или используйте кнопку "📱 Отправить номер" для автоматической отправки.',
        Markup.keyboard([
          [Markup.button.contactRequest('📱 Отправить номер')],
          ['❌ Отменить заказ'],
        ]).resize(),
      );
      return;
    }

    // Добавляем + в начало, если его нет
    const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

    ctx.session.phone = formattedPhone;

    if (telegramId) {
      await this.prisma.user.update({
        where: { telegramId },
        data: { phone: formattedPhone },
      });
      this.logger.log(`[PHONE] Phone saved for user ${telegramId}: ${formattedPhone}`);
    }

    ctx.session.orderStep = 'awaiting_address';
    await ctx.reply(
      '✅ Номер телефона сохранен!\n\n📍 Теперь введите адрес доставки в Минске:',
      Markup.keyboard([['❌ Отменить заказ']]).resize(),
    );
  }
}
