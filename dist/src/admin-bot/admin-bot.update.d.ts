import { Telegraf } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import type { BotContext } from '../common/interfaces/bot-context.interface';
import { AdminBotService } from './admin-bot.service';
import { ClientBotService } from '../client-bot/client-bot.service';
import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class AdminGuard implements CanActivate {
    private readonly prisma;
    constructor(prisma: PrismaService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export declare class AdminBotUpdate {
    private readonly bot;
    private readonly prisma;
    private readonly adminBotService;
    private readonly clientBotService;
    constructor(bot: Telegraf<BotContext>, prisma: PrismaService, adminBotService: AdminBotService, clientBotService: ClientBotService);
    onStart(ctx: BotContext): Promise<void>;
    onStockCommand(ctx: BotContext): Promise<void>;
    onText(ctx: BotContext): Promise<void>;
    private handleProductEdit;
    private startAddingProduct;
    private handleProductAdd;
    private showStockList;
    private showAcceptedOrders;
    private showCancelledOrders;
    private showProductsForEdit;
    private showActiveOrders;
    private showProducts;
    onAcceptOrder(ctx: BotContext): Promise<void>;
    onCancelOrder(ctx: BotContext): Promise<void>;
    onCompleteOrder(ctx: BotContext): Promise<void>;
    onToggleProduct(ctx: BotContext): Promise<void>;
    onAddStock(ctx: BotContext): Promise<void>;
    onRemoveStock(ctx: BotContext): Promise<void>;
    onEditPrice(ctx: BotContext): Promise<void>;
    onEditStock(ctx: BotContext): Promise<void>;
    private handleOrderAction;
    private handleToggleProduct;
}
