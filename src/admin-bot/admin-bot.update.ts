import { Update, Start, Command, On, InjectBot, Ctx, Action } from 'nestjs-telegraf';
import { Telegraf, Markup } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import type { BotContext } from '../common/interfaces/bot-context.interface';
import { AdminBotService } from './admin-bot.service';
import { ClientBotService } from '../client-bot/client-bot.service';
import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.getArgByIndex(0) as BotContext;
    const telegramId = ctx.from?.id.toString();

    if (!telegramId) return false;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    return user?.role === 'ADMIN';
  }
}

@Update()
export class AdminBotUpdate {
  private readonly logger = new Logger(AdminBotUpdate.name);

  constructor(
    @InjectBot('admin')
    private readonly bot: Telegraf<BotContext>,
    private readonly prisma: PrismaService,
    private readonly adminBotService: AdminBotService,
    private readonly clientBotService: ClientBotService,
  ) {}

  @Start()
  async onStart(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    this.logger.log(`[START] Admin ${telegramId} (${ctx.from?.username}) started admin bot`);

    if (!telegramId) return;

    let user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    // Проверяем whitelist из переменных окружения
    const adminWhitelist = process.env.ADMIN_WHITELIST?.split(',').map(id => id.trim()) || [];
    const isInWhitelist = adminWhitelist.includes(telegramId);

    // Если пользователя нет, создаем
    if (!user) {
      // Только пользователи из whitelist могут стать админами при первом запуске
      if (!isInWhitelist) {
        this.logger.warn(`[ACCESS_DENIED] User ${telegramId} not in whitelist, cannot create admin account`);
        await ctx.reply('❌ У вас нет доступа к админ-панели.\n\nДля получения доступа обратитесь к администратору.');
        return;
      }

      this.logger.log(`[REGISTER] Creating new admin from whitelist: ${telegramId} (${ctx.from?.username})`);
      user = await this.prisma.user.create({
        data: {
          telegramId,
          username: ctx.from?.username,
          role: 'ADMIN',
        },
      });
      this.logger.log(`[REGISTER] Admin created successfully: ${user.id}`);
    }

    // Проверяем роль пользователя
    if (user.role !== 'ADMIN') {
      this.logger.warn(`[ACCESS_DENIED] User ${telegramId} tried to access admin panel without ADMIN role`);
      await ctx.reply('❌ У вас нет доступа к админ-панели.\n\nДля получения доступа обратитесь к администратору.');
      return;
    }

    this.logger.log(`[START] Admin ${telegramId} accessed admin panel`);
    await ctx.reply(
      '🔧 Админ-панель\n\nВыберите действие:',
      Markup.keyboard([
        ['📦 Товары на складе'],
        ['✅ Принятые заказы', '❌ Отклоненные заказы'],
        ['➕ Добавить товар', '✏️ Изменить товар'],
        ['👥 Управление админами'],
      ]).resize(),
    );
  }

  @Command('stock')
  async onStockCommand(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    this.logger.log(`[COMMAND] Admin ${telegramId} used /stock command`);

    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      this.logger.warn(`[ACCESS_DENIED] User ${telegramId} tried to use /stock without ADMIN role`);
      await ctx.reply('❌ У вас нет доступа к этой команде.');
      return;
    }

    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

    this.logger.log(`[STOCK] Found ${products.length} products for admin ${telegramId}`);

    if (products.length === 0) {
      await ctx.reply('Товары отсутствуют.');
      return;
    }

    let stockText = '📦 Товары на складе:\n\n';

    for (const product of products) {
      const status = product.isActive ? '✅' : '❌';
      stockText += `${status} ${product.name}\n`;
      stockText += `💰 Цена: ${product.price} BYN\n`;
      stockText += `📦 Остаток: ${product.stock} шт.\n\n`;
    }

    await ctx.reply(stockText);
  }

  @On('text')
  async onText(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      this.logger.warn(`[ACCESS_DENIED] User ${telegramId} tried to access admin panel without ADMIN role`);
      await ctx.reply('❌ У вас нет доступа к админ-панели.');
      return;
    }

    const text = (ctx.message as { text: string }).text;
    this.logger.log(`[TEXT] Admin ${telegramId} sent: "${text}"`);

    // Проверяем, добавляет ли админ нового админа
    if (ctx.session.addingAdmin) {
      await this.handleAddAdmin(ctx, text);
      return;
    }

    // Проверяем, добавляет ли админ новый товар
    if (ctx.session.addingProduct) {
      await this.handleProductAdd(ctx, text);
      return;
    }

    // Проверяем, редактирует ли админ товар
    if (ctx.session.editingProduct && ctx.session.editingField) {
      await this.handleProductEdit(ctx, text);
      return;
    }

    if (text === '📦 Товары на складе') {
      this.logger.log(`[STOCK] Admin ${telegramId} opened stock list`);
      await this.showStockList(ctx);
    } else if (text === '✅ Принятые заказы') {
      this.logger.log(`[ORDERS] Admin ${telegramId} opened accepted orders`);
      await this.showAcceptedOrders(ctx);
    } else if (text === '❌ Отклоненные заказы') {
      this.logger.log(`[ORDERS] Admin ${telegramId} opened cancelled orders`);
      await this.showCancelledOrders(ctx);
    } else if (text === '➕ Добавить товар') {
      this.logger.log(`[PRODUCT] Admin ${telegramId} started adding product`);
      await this.startAddingProduct(ctx);
    } else if (text === '✏️ Изменить товар') {
      this.logger.log(`[PRODUCT] Admin ${telegramId} opened product edit menu`);
      await this.showProductsForEdit(ctx);
    } else if (text === '👥 Управление админами') {
      this.logger.log(`[ADMIN_MANAGEMENT] Admin ${telegramId} opened admin management`);
      await this.showAdminManagement(ctx);
    } else if (text === '➕ Добавить админа') {
      this.logger.log(`[ADMIN_ADD] Admin ${telegramId} started adding admin`);
      ctx.session.addingAdmin = true;
      await ctx.reply(
        '➕ Добавление нового админа\n\n' +
        'Введите Telegram ID пользователя, которого хотите сделать админом.\n\n' +
        'Чтобы узнать свой Telegram ID, можно использовать бота @userinfobot',
        Markup.keyboard([['🔙 Отменить']]).resize(),
      );
    } else if (text === '🔙 Назад в меню') {
      this.logger.log(`[MENU] Admin ${telegramId} returned to main menu`);
      await ctx.reply(
        '🔧 Админ-панель\n\nВыберите действие:',
        Markup.keyboard([
          ['📦 Товары на складе'],
          ['✅ Принятые заказы', '❌ Отклоненные заказы'],
          ['➕ Добавить товар', '✏️ Изменить товар'],
          ['👥 Управление админами'],
        ]).resize(),
      );
    }
  }

  private async handleProductEdit(ctx: BotContext, input: string): Promise<void> {
    const productId = ctx.session.editingProduct;
    const field = ctx.session.editingField;
    const telegramId = ctx.from?.id.toString();

    if (!productId || !field) return;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      this.logger.warn(`[PRODUCT_EDIT] Product ${productId} not found for admin ${telegramId}`);
      await ctx.reply('❌ Товар не найден.');
      delete ctx.session.editingProduct;
      delete ctx.session.editingField;
      return;
    }

    if (field === 'price') {
      const price = parseFloat(input);
      if (isNaN(price) || price <= 0) {
        this.logger.warn(`[PRODUCT_EDIT] Admin ${telegramId} entered invalid price: ${input}`);
        await ctx.reply('❌ Неверный формат цены. Введите число (например: 3.50):');
        return;
      }

      await this.prisma.product.update({
        where: { id: productId },
        data: { price },
      });

      this.logger.log(`[PRODUCT_EDIT] Admin ${telegramId} updated price for product ${productId}: ${price} BYN`);
      await ctx.reply(`✅ Цена товара "${product.name}" обновлена: ${price} BYN`);
    } else if (field === 'stock') {
      const stock = parseInt(input, 10);
      if (isNaN(stock) || stock < 0) {
        this.logger.warn(`[PRODUCT_EDIT] Admin ${telegramId} entered invalid stock: ${input}`);
        await ctx.reply('❌ Неверный формат количества. Введите целое число (например: 100):');
        return;
      }

      await this.prisma.product.update({
        where: { id: productId },
        data: { stock },
      });

      this.logger.log(`[PRODUCT_EDIT] Admin ${telegramId} updated stock for product ${productId}: ${stock} units`);
      await ctx.reply(`✅ Остаток товара "${product.name}" обновлен: ${stock} шт.`);
    }

    delete ctx.session.editingProduct;
    delete ctx.session.editingField;
  }

  private async startAddingProduct(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    this.logger.log(`[PRODUCT_ADD] Admin ${telegramId} started product wizard`);

    ctx.session.addingProduct = {
      step: 'name',
    };

    await ctx.reply(
      '➕ Добавление нового товара\n\n' +
      'Шаг 1/3: Введите название товара (например: Помидоры):',
      Markup.keyboard([['❌ Отменить']]).resize(),
    );
  }

  private async handleProductAdd(ctx: BotContext, input: string): Promise<void> {
    const telegramId = ctx.from?.id.toString();

    if (input === '❌ Отменить') {
      this.logger.log(`[PRODUCT_ADD] Admin ${telegramId} cancelled product addition`);
      delete ctx.session.addingProduct;
      await ctx.reply(
        '❌ Добавление товара отменено.',
        Markup.keyboard([
          ['📦 Товары на складе'],
          ['✅ Принятые заказы', '❌ Отклоненные заказы'],
          ['➕ Добавить товар', '✏️ Изменить товар'],
        ]).resize(),
      );
      return;
    }

    const addingProduct = ctx.session.addingProduct;
    if (!addingProduct) return;

    if (addingProduct.step === 'name') {
      if (input.trim().length < 2) {
        this.logger.warn(`[PRODUCT_ADD] Admin ${telegramId} entered invalid name: "${input}"`);
        await ctx.reply('❌ Название слишком короткое. Введите минимум 2 символа:');
        return;
      }

      addingProduct.name = input.trim();
      addingProduct.step = 'price';
      this.logger.log(`[PRODUCT_ADD] Admin ${telegramId} set product name: "${input.trim()}"`);

      await ctx.reply('Шаг 2/3: Введите цену товара в BYN (например: 3.50):');
    } else if (addingProduct.step === 'price') {
      const price = parseFloat(input);
      if (isNaN(price) || price <= 0) {
        this.logger.warn(`[PRODUCT_ADD] Admin ${telegramId} entered invalid price: ${input}`);
        await ctx.reply('❌ Неверный формат цены. Введите число больше 0 (например: 3.50):');
        return;
      }

      addingProduct.price = price;
      addingProduct.step = 'stock';
      this.logger.log(`[PRODUCT_ADD] Admin ${telegramId} set product price: ${price} BYN`);

      await ctx.reply('Шаг 3/3: Введите количество товара на складе (например: 100):');
    } else if (addingProduct.step === 'stock') {
      const stock = parseInt(input, 10);
      if (isNaN(stock) || stock < 0) {
        this.logger.warn(`[PRODUCT_ADD] Admin ${telegramId} entered invalid stock: ${input}`);
        await ctx.reply('❌ Неверный формат количества. Введите целое число >= 0 (например: 100):');
        return;
      }

      addingProduct.stock = stock;
      this.logger.log(`[PRODUCT_ADD] Admin ${telegramId} set product stock: ${stock} units`);

      // Создаем товар
      const product = await this.prisma.product.create({
        data: {
          name: addingProduct.name!,
          price: addingProduct.price!,
          stock: addingProduct.stock!,
          isActive: true,
        },
      });

      this.logger.log(`[PRODUCT_ADD] Admin ${telegramId} created product ${product.id}: "${product.name}"`);
      delete ctx.session.addingProduct;

      await ctx.reply(
        `✅ Товар успешно добавлен!\n\n` +
        `📦 ${product.name}\n` +
        `💰 Цена: ${product.price} BYN\n` +
        `📦 Остаток: ${product.stock} шт.\n` +
        `Статус: ✅ Активен`,
        Markup.keyboard([
          ['📦 Товары на складе'],
          ['✅ Принятые заказы', '❌ Отклоненные заказы'],
          ['➕ Добавить товар', '✏️ Изменить товар'],
        ]).resize(),
      );
    }
  }

  private async showStockList(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

    this.logger.log(`[STOCK] Admin ${telegramId} viewing stock list: ${products.length} products`);

    if (products.length === 0) {
      await ctx.reply('Товары отсутствуют.');
      return;
    }

    let stockText = '📦 Товары на складе:\n\n';

    for (const product of products) {
      const status = product.isActive ? '✅' : '❌';
      stockText += `${status} ${product.name}\n`;
      stockText += `💰 Цена: ${product.price} BYN\n`;
      stockText += `📦 Остаток: ${product.stock} шт.\n\n`;
    }

    await ctx.reply(stockText);
  }

  private async showAcceptedOrders(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    const orders = await this.prisma.order.findMany({
      where: { status: 'ACCEPTED' },
      include: {
        user: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    this.logger.log(`[ORDERS] Admin ${telegramId} viewing accepted orders: ${orders.length} found`);

    if (orders.length === 0) {
      await ctx.reply('Нет принятых заказов.');
      return;
    }

    for (const order of orders) {
      let orderText = `✅ Заказ #${order.id.slice(0, 8)}\n`;
      orderText += `👤 Клиент: ${order.user.username || 'Без имени'}\n`;
      orderText += `📞 Телефон: ${order.user.phone || 'Не указан'}\n`;
      orderText += `📍 Адрес: ${order.address}\n\n`;
      orderText += `📦 Товары:\n`;

      for (const item of order.orderItems) {
        orderText += `- ${item.product.name} x${item.quantity}\n`;
      }

      orderText += `\n💰 Итого: ${order.totalAmount} BYN`;

      const buttons = Markup.inlineKeyboard([
        [Markup.button.callback('🎉 Завершить', `complete_${order.id}`)],
      ]);

      await ctx.reply(orderText, buttons);
    }
  }

  private async showCancelledOrders(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    const orders = await this.prisma.order.findMany({
      where: { status: 'CANCELLED' },
      include: {
        user: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    this.logger.log(`[ORDERS] Admin ${telegramId} viewing cancelled orders: ${orders.length} found`);

    if (orders.length === 0) {
      await ctx.reply('Нет отклоненных заказов.');
      return;
    }

    for (const order of orders) {
      let orderText = `❌ Заказ #${order.id.slice(0, 8)}\n`;
      orderText += `👤 Клиент: ${order.user.username || 'Без имени'}\n`;
      orderText += `📞 Телефон: ${order.user.phone || 'Не указан'}\n`;
      orderText += `📍 Адрес: ${order.address}\n\n`;
      orderText += `📦 Товары:\n`;

      for (const item of order.orderItems) {
        orderText += `- ${item.product.name} x${item.quantity}\n`;
      }

      orderText += `\n💰 Итого: ${order.totalAmount} BYN`;

      await ctx.reply(orderText);
    }
  }

  private async showProductsForEdit(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

    this.logger.log(`[PRODUCT_EDIT] Admin ${telegramId} viewing products for edit: ${products.length} found`);

    if (products.length === 0) {
      await ctx.reply('Товары отсутствуют.');
      return;
    }

    await ctx.reply('Выберите товар для редактирования:');

    for (const product of products) {
      const status = product.isActive ? '✅' : '❌';
      let productText = `${status} ${product.name}\n`;
      productText += `💰 Цена: ${product.price} BYN\n`;
      productText += `📦 Остаток: ${product.stock} шт.`;

      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback('💰 Изменить цену', `edit_price_${product.id}`),
          Markup.button.callback('📦 Изменить остаток', `edit_stock_${product.id}`),
        ],
        [
          Markup.button.callback(
            product.isActive ? '❌ Деактивировать' : '✅ Активировать',
            `toggle_${product.id}`,
          ),
        ],
      ]);

      await ctx.reply(productText, buttons);
    }
  }

  private async showActiveOrders(ctx: BotContext): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          in: ['PENDING', 'ACCEPTED'],
        },
      },
      include: {
        user: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (orders.length === 0) {
      await ctx.reply('Нет активных заказов.');
      return;
    }

    for (const order of orders) {
      let orderText = `📋 Заказ #${order.id.slice(0, 8)}\n`;
      orderText += `Статус: ${order.status}\n`;
      orderText += `👤 Клиент: ${order.user.username || 'Без имени'}\n`;
      orderText += `📞 Телефон: ${order.user.phone || 'Не указан'}\n`;
      orderText += `📍 Адрес: ${order.address}\n\n`;
      orderText += `📦 Товары:\n`;

      for (const item of order.orderItems) {
        orderText += `- ${item.product.name} x${item.quantity}\n`;
      }

      orderText += `\n💰 Итого: ${order.totalAmount} BYN`;

      const buttons = [];

      if (order.status === 'PENDING') {
        buttons.push([
          Markup.button.callback('✅ Принять', `accept_${order.id}`),
          Markup.button.callback('❌ Отменить', `cancel_${order.id}`),
        ]);
      } else if (order.status === 'ACCEPTED') {
        buttons.push([
          Markup.button.callback('🎉 Завершить', `complete_${order.id}`),
          Markup.button.callback('❌ Отменить', `cancel_${order.id}`),
        ]);
      }

      await ctx.reply(orderText, Markup.inlineKeyboard(buttons));
    }
  }

  private async showProducts(ctx: BotContext): Promise<void> {
    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) {
      await ctx.reply('Товары отсутствуют.');
      return;
    }

    for (const product of products) {
      const status = product.isActive ? '✅ Активен' : '❌ Неактивен';
      let productText = `${product.name}\n`;
      productText += `💰 Цена: ${product.price} BYN\n`;
      productText += `📦 Остаток: ${product.stock} шт.\n`;
      productText += `Статус: ${status}`;

      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback('➕ Добавить остаток', `add_stock_${product.id}`),
          Markup.button.callback('➖ Убавить остаток', `remove_stock_${product.id}`),
        ],
        [
          Markup.button.callback(
            product.isActive ? '❌ Деактивировать' : '✅ Активировать',
            `toggle_${product.id}`,
          ),
        ],
      ]);

      await ctx.reply(productText, buttons);
    }
  }

  @Action(/^accept_/)
  async onAcceptOrder(ctx: BotContext): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      this.logger.warn(`[ACCESS_DENIED] User ${telegramId} tried to accept order without ADMIN role`);
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const orderId = callbackQuery.data.replace('accept_', '');
    this.logger.log(`[ORDER_ACTION] Admin ${telegramId} accepting order ${orderId}`);
    await this.handleOrderAction(ctx, orderId, 'ACCEPTED');
  }

  @Action(/^cancel_/)
  async onCancelOrder(ctx: BotContext): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      this.logger.warn(`[ACCESS_DENIED] User ${telegramId} tried to cancel order without ADMIN role`);
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const orderId = callbackQuery.data.replace('cancel_', '');
    this.logger.log(`[ORDER_ACTION] Admin ${telegramId} cancelling order ${orderId}`);
    await this.handleOrderAction(ctx, orderId, 'CANCELLED');
  }

  @Action(/^complete_/)
  async onCompleteOrder(ctx: BotContext): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      this.logger.warn(`[ACCESS_DENIED] User ${telegramId} tried to complete order without ADMIN role`);
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const orderId = callbackQuery.data.replace('complete_', '');
    this.logger.log(`[ORDER_ACTION] Admin ${telegramId} completing order ${orderId}`);
    await this.handleOrderAction(ctx, orderId, 'COMPLETED');
  }

  @Action(/^toggle_/)
  async onToggleProduct(ctx: BotContext): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      this.logger.warn(`[ACCESS_DENIED] User ${telegramId} tried to toggle product without ADMIN role`);
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const productId = callbackQuery.data.replace('toggle_', '');
    this.logger.log(`[PRODUCT_TOGGLE] Admin ${telegramId} toggling product ${productId}`);
    await this.handleToggleProduct(ctx, productId);
  }

  @Action(/^add_stock_/)
  async onAddStock(ctx: BotContext): Promise<void> {
    await ctx.answerCbQuery('Функция в разработке');
  }

  @Action(/^remove_stock_/)
  async onRemoveStock(ctx: BotContext): Promise<void> {
    await ctx.answerCbQuery('Функция в разработке');
  }

  @Action(/^edit_price_/)
  async onEditPrice(ctx: BotContext): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      this.logger.warn(`[ACCESS_DENIED] User ${telegramId} tried to edit price without ADMIN role`);
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const productId = callbackQuery.data.replace('edit_price_', '');
    this.logger.log(`[PRODUCT_EDIT] Admin ${telegramId} started editing price for product ${productId}`);

    ctx.session.editingProduct = productId;
    ctx.session.editingField = 'price';

    await ctx.answerCbQuery();
    await ctx.reply('💰 Введите новую цену (например: 3.50):');
  }

  @Action(/^edit_stock_/)
  async onEditStock(ctx: BotContext): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      this.logger.warn(`[ACCESS_DENIED] User ${telegramId} tried to edit stock without ADMIN role`);
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const productId = callbackQuery.data.replace('edit_stock_', '');
    this.logger.log(`[PRODUCT_EDIT] Admin ${telegramId} started editing stock for product ${productId}`);

    ctx.session.editingProduct = productId;
    ctx.session.editingField = 'stock';

    await ctx.answerCbQuery();
    await ctx.reply('📦 Введите новое количество (например: 100):');
  }

  private async handleOrderAction(
    ctx: BotContext,
    orderId: string,
    newStatus: 'ACCEPTED' | 'CANCELLED' | 'COMPLETED',
  ): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      this.logger.warn(`[ORDER_ACTION] Order ${orderId} not found for admin ${telegramId}`);
      await ctx.answerCbQuery('Заказ не найден');
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    this.logger.log(`[ORDER_ACTION] Admin ${telegramId} changed order ${orderId} status to ${newStatus}`);

    const statusText = {
      ACCEPTED: '✅ Заказ принят',
      CANCELLED: '❌ Заказ отменен',
      COMPLETED: '🎉 Заказ завершен',
    }[newStatus];

    await ctx.answerCbQuery(statusText);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

    await this.clientBotService.sendOrderStatusUpdate(
      Number(order.user.telegramId),
      order.id,
      newStatus,
    );

    this.logger.log(`[ORDER_ACTION] Notification sent to client ${order.user.telegramId} for order ${orderId}`);
  }

  private async handleToggleProduct(ctx: BotContext, productId: string): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      this.logger.warn(`[PRODUCT_TOGGLE] Product ${productId} not found for admin ${telegramId}`);
      await ctx.answerCbQuery('Товар не найден');
      return;
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { isActive: !product.isActive },
    });

    const newStatus = !product.isActive ? 'activated' : 'deactivated';
    this.logger.log(`[PRODUCT_TOGGLE] Admin ${telegramId} ${newStatus} product ${productId} (${product.name})`);

    await ctx.answerCbQuery(product.isActive ? '❌ Товар деактивирован' : '✅ Товар активирован');
  }

  private async showAdminManagement(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    this.logger.log(`[ADMIN_MANAGEMENT] Admin ${telegramId} viewing admin management`);

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });

    let adminText = '👥 Управление админами\n\n';
    adminText += `Всего админов: ${admins.length}\n\n`;

    for (const admin of admins) {
      adminText += `👤 ${admin.username || 'Без имени'}\n`;
      adminText += `ID: ${admin.telegramId}\n`;
      adminText += `Добавлен: ${admin.createdAt.toLocaleDateString('ru-RU')}\n\n`;
    }

    await ctx.reply(
      adminText,
      Markup.keyboard([
        ['➕ Добавить админа', '➖ Удалить админа'],
        ['🔙 Назад в меню'],
      ]).resize(),
    );
  }

  private async handleAddAdmin(ctx: BotContext, input: string): Promise<void> {
    const telegramId = ctx.from?.id.toString();

    if (input === '🔙 Отменить') {
      this.logger.log(`[ADMIN_ADD] Admin ${telegramId} cancelled adding admin`);
      delete ctx.session.addingAdmin;
      await ctx.reply(
        '❌ Добавление админа отменено.',
        Markup.keyboard([
          ['📦 Товары на складе'],
          ['✅ Принятые заказы', '❌ Отклоненные заказы'],
          ['➕ Добавить товар', '✏️ Изменить товар'],
          ['👥 Управление админами'],
        ]).resize(),
      );
      return;
    }

    // Проверяем, что введен корректный Telegram ID (только цифры)
    const newAdminId = input.trim();
    if (!/^\d+$/.test(newAdminId)) {
      this.logger.warn(`[ADMIN_ADD] Admin ${telegramId} entered invalid Telegram ID: ${input}`);
      await ctx.reply('❌ Неверный формат Telegram ID. Введите только цифры (например: 123456789):');
      return;
    }

    // Проверяем, не является ли пользователь уже админом
    const existingUser = await this.prisma.user.findUnique({
      where: { telegramId: newAdminId },
    });

    if (existingUser && existingUser.role === 'ADMIN') {
      this.logger.warn(`[ADMIN_ADD] User ${newAdminId} is already an admin`);
      await ctx.reply('❌ Этот пользователь уже является админом.');
      delete ctx.session.addingAdmin;
      return;
    }

    // Создаем или обновляем пользователя с ролью ADMIN
    if (existingUser) {
      await this.prisma.user.update({
        where: { telegramId: newAdminId },
        data: { role: 'ADMIN' },
      });
      this.logger.log(`[ADMIN_ADD] Admin ${telegramId} promoted user ${newAdminId} to admin`);
    } else {
      await this.prisma.user.create({
        data: {
          telegramId: newAdminId,
          role: 'ADMIN',
        },
      });
      this.logger.log(`[ADMIN_ADD] Admin ${telegramId} created new admin ${newAdminId}`);
    }

    delete ctx.session.addingAdmin;

    await ctx.reply(
      `✅ Админ успешно добавлен!\n\nTelegram ID: ${newAdminId}\n\nТеперь этот пользователь может запустить админ-бота и получить доступ к панели управления.`,
      Markup.keyboard([
        ['📦 Товары на складе'],
        ['✅ Принятые заказы', '❌ Отклоненные заказы'],
        ['➕ Добавить товар', '✏️ Изменить товар'],
        ['👥 Управление админами'],
      ]).resize(),
    );
  }
}
