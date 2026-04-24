import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Markup } from 'telegraf';
import { BotContext } from '../common/interfaces/bot-context.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminBotService {
  private readonly logger = new Logger(AdminBotService.name);

  constructor(
    @InjectBot('admin')
    private readonly bot: Telegraf<BotContext>,
    private readonly prisma: PrismaService,
  ) {}

  async notifyNewOrder(orderId: string): Promise<void> {
    this.logger.log(`[NOTIFY] Notifying admins about new order ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      this.logger.warn(`[NOTIFY] Order ${orderId} not found`);
      return;
    }

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
    });

    this.logger.log(`[NOTIFY] Found ${admins.length} admins to notify about order ${orderId}`);

    let orderText = `🔔 Новый заказ #${order.id.slice(0, 8)}\n\n`;
    orderText += `👤 Клиент: ${order.user.username || 'Без имени'}\n`;
    orderText += `📞 Телефон: ${order.user.phone || 'Не указан'}\n`;
    orderText += `📍 Адрес: ${order.address}\n\n`;
    orderText += `📦 Товары:\n`;

    for (const item of order.orderItems) {
      orderText += `- ${item.product.name} x${item.quantity} = ${Number(item.price) * item.quantity} BYN\n`;
    }

    orderText += `\n💰 Итого: ${order.totalAmount} BYN`;

    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Принять', `accept_${orderId}`),
        Markup.button.callback('❌ Отменить', `cancel_${orderId}`),
      ],
    ]);

    for (const admin of admins) {
      try {
        await this.bot.telegram.sendMessage(admin.telegramId, orderText, buttons);
        this.logger.log(`[NOTIFY] Successfully notified admin ${admin.telegramId} about order ${orderId}`);
      } catch (error) {
        this.logger.error(`[NOTIFY] Failed to notify admin ${admin.telegramId} about order ${orderId}:`, error);
      }
    }
  }

  async sendMessage(chatId: string, text: string, extra?: object): Promise<void> {
    this.logger.log(`[MESSAGE] Sending message to chat ${chatId}`);
    try {
      await this.bot.telegram.sendMessage(chatId, text, extra);
      this.logger.log(`[MESSAGE] Message sent successfully to chat ${chatId}`);
    } catch (error) {
      this.logger.error(`[MESSAGE] Failed to send message to chat ${chatId}:`, error);
      throw error;
    }
  }
}
