import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BotContext } from '../common/interfaces/bot-context.interface';

@Injectable()
export class ClientBotService {
  private readonly logger = new Logger(ClientBotService.name);

  constructor(
    @InjectBot('client')
    private readonly bot: Telegraf<BotContext>,
  ) {}

  async sendMessage(chatId: number, text: string, extra?: object): Promise<void> {
    this.logger.log(`[MESSAGE] Sending message to client ${chatId}`);
    try {
      await this.bot.telegram.sendMessage(chatId, text, extra);
      this.logger.log(`[MESSAGE] Message sent successfully to client ${chatId}`);
    } catch (error) {
      this.logger.error(`[MESSAGE] Failed to send message to client ${chatId}:`, error);
      throw error;
    }
  }

  async sendOrderConfirmation(chatId: number, orderId: string): Promise<void> {
    this.logger.log(`[ORDER_CONFIRMATION] Sending order confirmation to client ${chatId} for order ${orderId}`);
    await this.sendMessage(
      chatId,
      `✅ Ваш заказ #${orderId} принят!\n\nМы свяжемся с вами в ближайшее время для подтверждения.`,
    );
  }

  async sendOrderStatusUpdate(chatId: number, orderId: string, status: string): Promise<void> {
    this.logger.log(`[STATUS_UPDATE] Sending status update to client ${chatId} for order ${orderId}: ${status}`);

    const statusText = {
      ACCEPTED: '✅ Ваш заказ принят в обработку',
      COMPLETED: '🎉 Ваш заказ выполнен',
      CANCELLED: '❌ Ваш заказ отменен',
    }[status] || 'Статус заказа изменен';

    await this.sendMessage(chatId, `Заказ #${orderId}: ${statusText}`);
  }
}
