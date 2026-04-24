import { Telegraf } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import type { BotContext } from '../common/interfaces/bot-context.interface';
import { ClientBotService } from './client-bot.service';
import { AdminBotService } from '../admin-bot/admin-bot.service';
export declare class ClientBotUpdate {
    private readonly bot;
    private readonly prisma;
    private readonly clientBotService;
    private readonly adminBotService;
    constructor(bot: Telegraf<BotContext>, prisma: PrismaService, clientBotService: ClientBotService, adminBotService: AdminBotService);
    onStart(ctx: BotContext): Promise<void>;
    onText(ctx: BotContext): Promise<void>;
    onContact(ctx: BotContext): Promise<void>;
    private showCatalog;
    private showCart;
    private showOrders;
    private handleAddress;
    onAddToCart(ctx: BotContext): Promise<void>;
    onRemoveFromCart(ctx: BotContext): Promise<void>;
    onCheckout(ctx: BotContext): Promise<void>;
    onClearCart(ctx: BotContext): Promise<void>;
}
