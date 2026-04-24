import { Update, Start, Command, On, InjectBot, Action } from 'nestjs-telegraf';
import { Telegraf, Markup } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import type { BotContext } from '../common/interfaces/bot-context.interface';
import { ClientBotService } from './client-bot.service';
import { AdminBotService } from '../admin-bot/admin-bot.service';

@Update()
export class ClientBotUpdate {
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
    if (!telegramId) return;

    let user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId,
          username: ctx.from?.username,
          role: 'CLIENT',
        },
      });
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

    if (text === '📦 Каталог товаров') {
      await this.showCatalog(ctx);
    } else if (text === '🛒 Моя корзина') {
      await this.showCart(ctx);
    } else if (text === '📋 Мои заказы') {
      await this.showOrders(ctx);
    } else if (ctx.session.orderStep === 'awaiting_address') {
      await this.handleAddress(ctx, text);
    }
  }

  @On('contact')
  async onContact(ctx: BotContext): Promise<void> {
    const contact = (ctx.message as { contact: { phone_number: string } }).contact;
    ctx.session.phone = contact.phone_number;

    const telegramId = ctx.from?.id.toString();
    if (telegramId) {
      await this.prisma.user.update({
        where: { telegramId },
        data: { phone: contact.phone_number },
      });
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

    if (products.length === 0) {
      await ctx.reply('К сожалению, товары временно отсутствуют.');
      return;
    }

    for (const product of products) {
      const buttons = Markup.inlineKeyboard([
        Markup.button.callback('➕ Добавить в корзину', `add_${product.id}`),
      ]);

      const text = `${product.name}\n💰 Цена: ${product.price} BYN\n📦 В наличии: ${product.stock} шт.`;

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
      ordersText += `Сумма: ${order.totalAmount} BYN\n`;
      ordersText += `Статус: ${order.status}\n\n`;
    }

    await ctx.reply(ordersText);
  }

  private async handleAddress(ctx: BotContext, address: string): Promise<void> {
    ctx.session.address = address;
    ctx.session.orderStep = undefined;

    const cart = ctx.session.cart || [];
    const telegramId = ctx.from?.id.toString();

    if (!telegramId || cart.length === 0) {
      await ctx.reply('Ошибка при оформлении заказа.');
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
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

      ctx.session.cart = [];

      await this.clientBotService.sendOrderConfirmation(ctx.chat!.id, order.id);
      await this.adminBotService.notifyNewOrder(order.id);

      await ctx.reply(
        '🏠 Вернуться в главное меню',
        Markup.keyboard([
          ['📦 Каталог товаров'],
          ['🛒 Моя корзина', '📋 Мои заказы'],
        ]).resize(),
      );
    } catch (error) {
      console.error('Order creation error:', error);
      await ctx.reply('Произошла ошибка при оформлении заказа. Попробуйте позже.');
    }
  }

  @Action(/^add_/)
  async onAddToCart(ctx: BotContext): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const productId = callbackQuery.data.replace('add_', '');
    ctx.session.cart = ctx.session.cart || [];

    const existingItem = ctx.session.cart.find((item) => item.productId === productId);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      ctx.session.cart.push({ productId, quantity: 1 });
    }

    await ctx.answerCbQuery('✅ Товар добавлен в корзину');
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
        '📞 Для оформления заказа поделитесь номером телефона:',
        Markup.keyboard([Markup.button.contactRequest('📱 Отправить номер')]).resize(),
      );
    } else {
      ctx.session.orderStep = 'awaiting_address';
      await ctx.reply('📍 Введите адрес доставки в Минске:', Markup.removeKeyboard());
    }

    await ctx.answerCbQuery();
  }

  @Action('clear_cart')
  async onClearCart(ctx: BotContext): Promise<void> {
    ctx.session.cart = [];
    await ctx.answerCbQuery('🗑 Корзина очищена');
    await ctx.editMessageText('🛒 Корзина очищена.');
  }
}
