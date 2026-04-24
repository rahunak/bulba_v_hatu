import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BotContext } from '../common/interfaces/bot-context.interface';

@Injectable()
export class ClientBotService {
  constructor(
    @InjectBot('client')
    private readonly bot: Telegraf<BotContext>,
  ) {}

  async sendMessage(chatId: number, text: string, extra?: object): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, text, extra);
  }

  async sendOrderConfirmation(chatId: number, orderId: string): Promise<void> {
    await this.sendMessage(
      chatId,
      `✅ Ваш заказ #${orderId} принят!\n\nМы свяжемся с вами в ближайшее время для подтверждения.`,
    );
  }

  async sendOrderStatusUpdate(chatId: number, orderId: string, status: string): Promise<void> {
    const statusText = {
      ACCEPTED: '✅ Ваш заказ принят в обработку',
      COMPLETED: '🎉 Ваш заказ выполнен',
      CANCELLED: '❌ Ваш заказ отменен',
    }[status] || 'Статус заказа изменен';

    await this.sendMessage(chatId, `Заказ #${orderId}: ${statusText}`);
  }
}
