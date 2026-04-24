import { Telegraf } from 'telegraf';
import { BotContext } from '../common/interfaces/bot-context.interface';
import { PrismaService } from '../prisma/prisma.service';
export declare class AdminBotService {
    private readonly bot;
    private readonly prisma;
    constructor(bot: Telegraf<BotContext>, prisma: PrismaService);
    notifyNewOrder(orderId: string): Promise<void>;
    sendMessage(chatId: string, text: string, extra?: object): Promise<void>;
}
