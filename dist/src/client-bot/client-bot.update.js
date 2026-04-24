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
exports.ClientBotUpdate = void 0;
const nestjs_telegraf_1 = require("nestjs-telegraf");
const telegraf_1 = require("telegraf");
const prisma_service_1 = require("../prisma/prisma.service");
const client_bot_service_1 = require("./client-bot.service");
const admin_bot_service_1 = require("../admin-bot/admin-bot.service");
let ClientBotUpdate = class ClientBotUpdate {
    bot;
    prisma;
    clientBotService;
    adminBotService;
    constructor(bot, prisma, clientBotService, adminBotService) {
        this.bot = bot;
        this.prisma = prisma;
        this.clientBotService = clientBotService;
        this.adminBotService = adminBotService;
    }
    async onStart(ctx) {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId)
            return;
        let user = await this.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    telegramId,
                    username: ctx.from?.username,
                    role: 'CLIENT',
                },
            });
        }
        ctx.session.cart = [];
        await ctx.reply('🥬 Добро пожаловать в магазин овощей!\n\nВыберите действие:', telegraf_1.Markup.keyboard([
            ['📦 Каталог товаров'],
            ['🛒 Моя корзина', '📋 Мои заказы'],
        ]).resize());
    }
    async onText(ctx) {
        const text = ctx.message.text;
        if (text === '📦 Каталог товаров') {
            await this.showCatalog(ctx);
        }
        else if (text === '🛒 Моя корзина') {
            await this.showCart(ctx);
        }
        else if (text === '📋 Мои заказы') {
            await this.showOrders(ctx);
        }
        else if (ctx.session.orderStep === 'awaiting_address') {
            await this.handleAddress(ctx, text);
        }
    }
    async onContact(ctx) {
        const contact = ctx.message.contact;
        ctx.session.phone = contact.phone_number;
        const telegramId = ctx.from?.id.toString();
        if (telegramId) {
            await this.prisma.user.update({
                where: { telegramId },
                data: { phone: contact.phone_number },
            });
        }
        ctx.session.orderStep = 'awaiting_address';
        await ctx.reply('📍 Отлично! Теперь введите адрес доставки в Минске:', telegraf_1.Markup.removeKeyboard());
    }
    async showCatalog(ctx) {
        const products = await this.prisma.product.findMany({
            where: { isActive: true, stock: { gt: 0 } },
        });
        if (products.length === 0) {
            await ctx.reply('К сожалению, товары временно отсутствуют.');
            return;
        }
        for (const product of products) {
            const buttons = telegraf_1.Markup.inlineKeyboard([
                telegraf_1.Markup.button.callback('➕ Добавить в корзину', `add_${product.id}`),
            ]);
            const text = `${product.name}\n💰 Цена: ${product.price} BYN\n📦 В наличии: ${product.stock} шт.`;
            if (product.photoId) {
                await ctx.replyWithPhoto(product.photoId, { caption: text, ...buttons });
            }
            else {
                await ctx.reply(text, buttons);
            }
        }
    }
    async showCart(ctx) {
        const cart = ctx.session.cart || [];
        if (cart.length === 0) {
            await ctx.reply('🛒 Ваша корзина пуста.');
            return;
        }
        let total = 0;
        let cartText = '🛒 Ваша корзина:\n\n';
        for (const item of cart) {
            const product = await this.prisma.product.findUnique({
                where: { id: item.productId },
            });
            if (product) {
                const itemTotal = Number(product.price) * item.quantity;
                total += itemTotal;
                cartText += `${product.name} x${item.quantity} = ${itemTotal.toFixed(2)} BYN\n`;
            }
        }
        cartText += `\n💰 Итого: ${total.toFixed(2)} BYN`;
        await ctx.reply(cartText, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('✅ Оформить заказ', 'checkout')],
            [telegraf_1.Markup.button.callback('🗑 Очистить корзину', 'clear_cart')],
        ]));
    }
    async showOrders(ctx) {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId)
            return;
        const user = await this.prisma.user.findUnique({
            where: { telegramId },
            include: {
                orders: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });
        if (!user || user.orders.length === 0) {
            await ctx.reply('У вас пока нет заказов.');
            return;
        }
        let ordersText = '📋 Ваши последние заказы:\n\n';
        for (const order of user.orders) {
            const statusEmoji = {
                PENDING: '⏳',
                ACCEPTED: '✅',
                COMPLETED: '🎉',
                CANCELLED: '❌',
            }[order.status];
            ordersText += `${statusEmoji} Заказ #${order.id.slice(0, 8)}\n`;
            ordersText += `Сумма: ${order.totalAmount} BYN\n`;
            ordersText += `Статус: ${order.status}\n\n`;
        }
        await ctx.reply(ordersText);
    }
    async handleAddress(ctx, address) {
        ctx.session.address = address;
        ctx.session.orderStep = undefined;
        const cart = ctx.session.cart || [];
        const telegramId = ctx.from?.id.toString();
        if (!telegramId || cart.length === 0) {
            await ctx.reply('Ошибка при оформлении заказа.');
            return;
        }
        const user = await this.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user) {
            await ctx.reply('Пользователь не найден.');
            return;
        }
        try {
            let totalAmount = 0;
            const orderItems = [];
            for (const item of cart) {
                const product = await this.prisma.product.findUnique({
                    where: { id: item.productId },
                });
                if (!product || product.stock < item.quantity) {
                    await ctx.reply(`Товар ${product?.name || 'неизвестен'} недоступен в нужном количестве.`);
                    return;
                }
                const itemPrice = Number(product.price) * item.quantity;
                totalAmount += itemPrice;
                orderItems.push({
                    productId: product.id,
                    quantity: item.quantity,
                    price: product.price,
                });
            }
            const order = await this.prisma.$transaction(async (tx) => {
                const newOrder = await tx.order.create({
                    data: {
                        userId: user.id,
                        address,
                        totalAmount,
                        status: 'PENDING',
                        orderItems: {
                            create: orderItems,
                        },
                    },
                });
                for (const item of cart) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: {
                            stock: {
                                decrement: item.quantity,
                            },
                        },
                    });
                }
                return newOrder;
            });
            ctx.session.cart = [];
            await this.clientBotService.sendOrderConfirmation(ctx.chat.id, order.id);
            await this.adminBotService.notifyNewOrder(order.id);
            await ctx.reply('🏠 Вернуться в главное меню', telegraf_1.Markup.keyboard([
                ['📦 Каталог товаров'],
                ['🛒 Моя корзина', '📋 Мои заказы'],
            ]).resize());
        }
        catch (error) {
            console.error('Order creation error:', error);
            await ctx.reply('Произошла ошибка при оформлении заказа. Попробуйте позже.');
        }
    }
    async onCallbackQuery(ctx) {
        const callbackQuery = ctx.callbackQuery;
        if (!callbackQuery || !('data' in callbackQuery))
            return;
        const data = callbackQuery.data;
        if (data.startsWith('add_')) {
            const productId = data.replace('add_', '');
            ctx.session.cart = ctx.session.cart || [];
            const existingItem = ctx.session.cart.find((item) => item.productId === productId);
            if (existingItem) {
                existingItem.quantity += 1;
            }
            else {
                ctx.session.cart.push({ productId, quantity: 1 });
            }
            await ctx.answerCbQuery('✅ Товар добавлен в корзину');
        }
        else if (data === 'checkout') {
            const cart = ctx.session.cart || [];
            if (cart.length === 0) {
                await ctx.answerCbQuery('Корзина пуста');
                return;
            }
            const telegramId = ctx.from?.id.toString();
            if (!telegramId)
                return;
            const user = await this.prisma.user.findUnique({
                where: { telegramId },
            });
            if (!user?.phone) {
                ctx.session.orderStep = 'awaiting_phone';
                await ctx.reply('📞 Для оформления заказа поделитесь номером телефона:', telegraf_1.Markup.keyboard([telegraf_1.Markup.button.contactRequest('📱 Отправить номер')]).resize());
            }
            else {
                ctx.session.orderStep = 'awaiting_address';
                await ctx.reply('📍 Введите адрес доставки в Минске:', telegraf_1.Markup.removeKeyboard());
            }
            await ctx.answerCbQuery();
        }
        else if (data === 'clear_cart') {
            ctx.session.cart = [];
            await ctx.answerCbQuery('🗑 Корзина очищена');
            await ctx.editMessageText('🛒 Корзина очищена.');
        }
    }
};
exports.ClientBotUpdate = ClientBotUpdate;
__decorate([
    (0, nestjs_telegraf_1.Start)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientBotUpdate.prototype, "onStart", null);
__decorate([
    (0, nestjs_telegraf_1.On)('text'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientBotUpdate.prototype, "onText", null);
__decorate([
    (0, nestjs_telegraf_1.On)('contact'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientBotUpdate.prototype, "onContact", null);
__decorate([
    (0, nestjs_telegraf_1.On)('callback_query'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientBotUpdate.prototype, "onCallbackQuery", null);
exports.ClientBotUpdate = ClientBotUpdate = __decorate([
    (0, nestjs_telegraf_1.Update)(),
    __param(0, (0, nestjs_telegraf_1.InjectBot)('client')),
    __metadata("design:paramtypes", [telegraf_1.Telegraf,
        prisma_service_1.PrismaService,
        client_bot_service_1.ClientBotService,
        admin_bot_service_1.AdminBotService])
], ClientBotUpdate);
//# sourceMappingURL=client-bot.update.js.map