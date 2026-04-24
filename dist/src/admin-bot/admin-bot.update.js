"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminBotUpdate = exports.AdminGuard = void 0;
const nestjs_telegraf_1 = require("nestjs-telegraf");
const telegraf_1 = require("telegraf");
const prisma_service_1 = require("../prisma/prisma.service");
const admin_bot_service_1 = require("./admin-bot.service");
const client_bot_service_1 = require("../client-bot/client-bot.service");
const common_1 = require("@nestjs/common");
let AdminGuard = class AdminGuard {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const ctx = context.getArgByIndex(0);
        const telegramId = ctx.from?.id.toString();
        if (!telegramId)
            return false;
        const user = await this.prisma.user.findUnique({
            where: { telegramId },
        });
        return user?.role === 'ADMIN';
    }
};
exports.AdminGuard = AdminGuard;
exports.AdminGuard = AdminGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminGuard);
let AdminBotUpdate = class AdminBotUpdate {
    bot;
    prisma;
    adminBotService;
    clientBotService;
    constructor(bot, prisma, adminBotService, clientBotService) {
        this.bot = bot;
        this.prisma = prisma;
        this.adminBotService = adminBotService;
        this.clientBotService = clientBotService;
    }
    async onStart(ctx) {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId)
            return;
        const user = await this.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user || user.role !== 'ADMIN') {
            await ctx.reply('❌ У вас нет доступа к админ-панели.');
            return;
        }
        await ctx.reply('🔧 Админ-панель\n\nВыберите действие:', telegraf_1.Markup.keyboard([
            ['📦 Управление товарами'],
            ['📋 Активные заказы'],
        ]).resize());
    }
    async onStockCommand(ctx) {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId)
            return;
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
    async onText(ctx) {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId)
            return;
        const user = await this.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user || user.role !== 'ADMIN') {
            await ctx.reply('❌ У вас нет доступа к админ-панели.');
            return;
        }
        const text = ctx.message.text;
        if (text === '📋 Активные заказы') {
            await this.showActiveOrders(ctx);
        }
        else if (text === '📦 Управление товарами') {
            await this.showProducts(ctx);
        }
    }
    async showActiveOrders(ctx) {
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
                    telegraf_1.Markup.button.callback('✅ Принять', `accept_${order.id}`),
                    telegraf_1.Markup.button.callback('❌ Отменить', `cancel_${order.id}`),
                ]);
            }
            else if (order.status === 'ACCEPTED') {
                buttons.push([
                    telegraf_1.Markup.button.callback('🎉 Завершить', `complete_${order.id}`),
                    telegraf_1.Markup.button.callback('❌ Отменить', `cancel_${order.id}`),
                ]);
            }
            await ctx.reply(orderText, telegraf_1.Markup.inlineKeyboard(buttons));
        }
    }
    async showProducts(ctx) {
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
            const buttons = telegraf_1.Markup.inlineKeyboard([
                [
                    telegraf_1.Markup.button.callback('➕ Добавить остаток', `add_stock_${product.id}`),
                    telegraf_1.Markup.button.callback('➖ Убавить остаток', `remove_stock_${product.id}`),
                ],
                [
                    telegraf_1.Markup.button.callback(product.isActive ? '❌ Деактивировать' : '✅ Активировать', `toggle_${product.id}`),
                ],
            ]);
            await ctx.reply(productText, buttons);
        }
    }
    async onCallbackQuery(ctx) {
        const callbackQuery = ctx.callbackQuery;
        if (!callbackQuery || !('data' in callbackQuery))
            return;
        const telegramId = ctx.from?.id.toString();
        if (!telegramId)
            return;
        const user = await this.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user || user.role !== 'ADMIN') {
            await ctx.answerCbQuery('❌ Нет доступа');
            return;
        }
        const data = callbackQuery.data;
        if (data.startsWith('accept_')) {
            await this.handleOrderAction(ctx, data.replace('accept_', ''), 'ACCEPTED');
        }
        else if (data.startsWith('cancel_')) {
            await this.handleOrderAction(ctx, data.replace('cancel_', ''), 'CANCELLED');
        }
        else if (data.startsWith('complete_')) {
            await this.handleOrderAction(ctx, data.replace('complete_', ''), 'COMPLETED');
        }
        else if (data.startsWith('toggle_')) {
            await this.handleToggleProduct(ctx, data.replace('toggle_', ''));
        }
        else if (data.startsWith('add_stock_')) {
            await ctx.answerCbQuery('Функция в разработке');
        }
        else if (data.startsWith('remove_stock_')) {
            await ctx.answerCbQuery('Функция в разработке');
        }
    }
    async handleOrderAction(ctx, orderId, newStatus) {
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
        await this.clientBotService.sendOrderStatusUpdate(Number(order.user.telegramId), order.id, newStatus);
    }
    async handleToggleProduct(ctx, productId) {
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
};
exports.AdminBotUpdate = AdminBotUpdate;
__decorate([
    (0, nestjs_telegraf_1.Start)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onStart", null);
__decorate([
    (0, nestjs_telegraf_1.Command)('stock'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onStockCommand", null);
__decorate([
    (0, nestjs_telegraf_1.On)('text'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onText", null);
__decorate([
    (0, nestjs_telegraf_1.On)('callback_query'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onCallbackQuery", null);
exports.AdminBotUpdate = AdminBotUpdate = __decorate([
    (0, nestjs_telegraf_1.Update)(),
    __param(0, (0, nestjs_telegraf_1.InjectBot)('admin')),
    __metadata("design:paramtypes", [telegraf_1.Telegraf,
        prisma_service_1.PrismaService,
        admin_bot_service_1.AdminBotService,
        client_bot_service_1.ClientBotService])
], AdminBotUpdate);
//# sourceMappingURL=admin-bot.update.js.map