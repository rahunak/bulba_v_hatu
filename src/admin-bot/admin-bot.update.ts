import { Update, Start, Command, On, InjectBot, Ctx, Action } from 'nestjs-telegraf';
import { Telegraf, Markup } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import type { BotContext } from '../common/interfaces/bot-context.interface';
import { AdminBotService } from './admin-bot.service';
import { ClientBotService } from '../client-bot/client-bot.service';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
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
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      await ctx.reply('❌ У вас нет доступа к админ-панели.');
      return;
    }

    await ctx.reply(
      '🔧 Админ-панель\n\nВыберите действие:',
      Markup.keyboard([
        ['📦 Управление товарами'],
        ['📋 Активные заказы'],
      ]).resize(),
    );
  }

  @Command('stock')
  async onStockCommand(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user || user.role !== 'ADMIN') {
      await ctx.reply('❌ У вас нет доступа к этой команде.');
      return;
    }

    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

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
      await ctx.reply('❌ У вас нет доступа к админ-панели.');
      return;
    }

    const text = (ctx.message as { text: string }).text;

    if (text === '📋 Активные заказы') {
      await this.showActiveOrders(ctx);
    } else if (text === '📦 Управление товарами') {
      await this.showProducts(ctx);
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
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const orderId = callbackQuery.data.replace('accept_', '');
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
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const orderId = callbackQuery.data.replace('cancel_', '');
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
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const orderId = callbackQuery.data.replace('complete_', '');
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
      await ctx.answerCbQuery('❌ Нет доступа');
      return;
    }

    const productId = callbackQuery.data.replace('toggle_', '');
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

  private async handleOrderAction(
    ctx: BotContext,
    orderId: string,
    newStatus: 'ACCEPTED' | 'CANCELLED' | 'COMPLETED',
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      await ctx.answerCbQuery('Заказ не найден');
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

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
  }

  private async handleToggleProduct(ctx: BotContext, productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      await ctx.answerCbQuery('Товар не найден');
      return;
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { isActive: !product.isActive },
    });

    await ctx.answerCbQuery(product.isActive ? '❌ Товар деактивирован' : '✅ Товар активирован');
  }
}
