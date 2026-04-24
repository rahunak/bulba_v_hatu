import { Telegraf } from 'telegraf';
import { BotContext } from '../common/interfaces/bot-context.interface';
export declare class ClientBotService {
    private readonly bot;
    constructor(bot: Telegraf<BotContext>);
    sendMessage(chatId: number, text: string, extra?: object): Promise<void>;
    sendOrderConfirmation(chatId: number, orderId: string): Promise<void>;
    sendOrderStatusUpdate(chatId: number, orderId: string, status: string): Promise<void>;
}
