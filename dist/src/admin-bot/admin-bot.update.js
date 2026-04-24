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
        let user = await this.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    telegramId,
                    username: ctx.from?.username,
                    role: 'ADMIN',
                },
            });
        }
        if (user.role !== 'ADMIN') {
            await ctx.reply('❌ У вас нет доступа к админ-панели.');
            return;
        }
        await ctx.reply('🔧 Админ-панель\n\nВыберите действие:', telegraf_1.Markup.keyboard([
            ['📦 Товары на складе'],
            ['✅ Принятые заказы', '❌ Отклоненные заказы'],
            ['➕ Добавить товар', '✏️ Изменить товар'],
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
        if (ctx.session.addingProduct) {
            await this.handleProductAdd(ctx, text);
            return;
        }
        if (ctx.session.editingProduct && ctx.session.editingField) {
            await this.handleProductEdit(ctx, text);
            return;
        }
        if (text === '📦 Товары на складе') {
            await this.showStockList(ctx);
        }
        else if (text === '✅ Принятые заказы') {
            await this.showAcceptedOrders(ctx);
        }
        else if (text === '❌ Отклоненные заказы') {
            await this.showCancelledOrders(ctx);
        }
        else if (text === '➕ Добавить товар') {
            await this.startAddingProduct(ctx);
        }
        else if (text === '✏️ Изменить товар') {
            await this.showProductsForEdit(ctx);
        }
    }
    async handleProductEdit(ctx, input) {
        const productId = ctx.session.editingProduct;
        const field = ctx.session.editingField;
        if (!productId || !field)
            return;
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            await ctx.reply('❌ Товар не найден.');
            delete ctx.session.editingProduct;
            delete ctx.session.editingField;
            return;
        }
        if (field === 'price') {
            const price = parseFloat(input);
            if (isNaN(price) || price <= 0) {
                await ctx.reply('❌ Неверный формат цены. Введите число (например: 3.50):');
                return;
            }
            await this.prisma.product.update({
                where: { id: productId },
                data: { price },
            });
            await ctx.reply(`✅ Цена товара "${product.name}" обновлена: ${price} BYN`);
        }
        else if (field === 'stock') {
            const stock = parseInt(input, 10);
            if (isNaN(stock) || stock < 0) {
                await ctx.reply('❌ Неверный формат количества. Введите целое число (например: 100):');
                return;
            }
            await this.prisma.product.update({
                where: { id: productId },
                data: { stock },
            });
            await ctx.reply(`✅ Остаток товара "${product.name}" обновлен: ${stock} шт.`);
        }
        delete ctx.session.editingProduct;
        delete ctx.session.editingField;
    }
    async startAddingProduct(ctx) {
        ctx.session.addingProduct = {
            step: 'name',
        };
        await ctx.reply('➕ Добавление нового товара\n\n' +
            'Шаг 1/3: Введите название товара (например: Помидоры):', telegraf_1.Markup.keyboard([['❌ Отменить']]).resize());
    }
    async handleProductAdd(ctx, input) {
        if (input === '❌ Отменить') {
            delete ctx.session.addingProduct;
            await ctx.reply('❌ Добавление товара отменено.', telegraf_1.Markup.keyboard([
                ['📦 Товары на складе'],
                ['✅ Принятые заказы', '❌ Отклоненные заказы'],
                ['➕ Добавить товар', '✏️ Изменить товар'],
            ]).resize());
            return;
        }
        const addingProduct = ctx.session.addingProduct;
        if (!addingProduct)
            return;
        if (addingProduct.step === 'name') {
            if (input.trim().length < 2) {
                await ctx.reply('❌ Название слишком короткое. Введите минимум 2 символа:');
                return;
            }
            addingProduct.name = input.trim();
            addingProduct.step = 'price';
            await ctx.reply('Шаг 2/3: Введите цену товара в BYN (например: 3.50):');
        }
        else if (addingProduct.step === 'price') {
            const price = parseFloat(input);
            if (isNaN(price) || price <= 0) {
                await ctx.reply('❌ Неверный формат цены. Введите число больше 0 (например: 3.50):');
                return;
            }
            addingProduct.price = price;
            addingProduct.step = 'stock';
            await ctx.reply('Шаг 3/3: Введите количество товара на складе (например: 100):');
        }
        else if (addingProduct.step === 'stock') {
            const stock = parseInt(input, 10);
            if (isNaN(stock) || stock < 0) {
                await ctx.reply('❌ Неверный формат количества. Введите целое число >= 0 (например: 100):');
                return;
            }
            addingProduct.stock = stock;
            const product = await this.prisma.product.create({
                data: {
                    name: addingProduct.name,
                    price: addingProduct.price,
                    stock: addingProduct.stock,
                    isActive: true,
                },
            });
            delete ctx.session.addingProduct;
            await ctx.reply(`✅ Товар успешно добавлен!\n\n` +
                `📦 ${product.name}\n` +
                `💰 Цена: ${product.price} BYN\n` +
                `📦 Остаток: ${product.stock} шт.\n` +
                `Статус: ✅ Активен`, telegraf_1.Markup.keyboard([
                ['📦 Товары на складе'],
                ['✅ Принятые заказы', '❌ Отклоненные заказы'],
                ['➕ Добавить товар', '✏️ Изменить товар'],
            ]).resize());
        }
    }
    async showStockList(ctx) {
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
    async showAcceptedOrders(ctx) {
        const orders = await this.prisma.order.findMany({
            where: { status: 'ACCEPTED' },
            include: {
                user: true,
                orderItems: {
                    include: {
                        product: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        if (orders.length === 0) {
            await ctx.reply('Нет принятых заказов.');
            return;
        }
        for (const order of orders) {
            let orderText = `✅ Заказ #${order.id.slice(0, 8)}\n`;
            orderText += `👤 Клиент: ${order.user.username || 'Без имени'}\n`;
            orderText += `📞 Телефон: ${order.user.phone || 'Не указан'}\n`;
            orderText += `📍 Адрес: ${order.address}\n\n`;
            orderText += `📦 Товары:\n`;
            for (const item of order.orderItems) {
                orderText += `- ${item.product.name} x${item.quantity}\n`;
            }
            orderText += `\n💰 Итого: ${order.totalAmount} BYN`;
            const buttons = telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('🎉 Завершить', `complete_${order.id}`)],
            ]);
            await ctx.reply(orderText, buttons);
        }
    }
    async showCancelledOrders(ctx) {
        const orders = await this.prisma.order.findMany({
            where: { status: 'CANCELLED' },
            include: {
                user: true,
                orderItems: {
                    include: {
                        product: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        if (orders.length === 0) {
            await ctx.reply('Нет отклоненных заказов.');
            return;
        }
        for (const order of orders) {
            let orderText = `❌ Заказ #${order.id.slice(0, 8)}\n`;
            orderText += `👤 Клиент: ${order.user.username || 'Без имени'}\n`;
            orderText += `📞 Телефон: ${order.user.phone || 'Не указан'}\n`;
            orderText += `📍 Адрес: ${order.address}\n\n`;
            orderText += `📦 Товары:\n`;
            for (const item of order.orderItems) {
                orderText += `- ${item.product.name} x${item.quantity}\n`;
            }
            orderText += `\n💰 Итого: ${order.totalAmount} BYN`;
            await ctx.reply(orderText);
        }
    }
    async showProductsForEdit(ctx) {
        const products = await this.prisma.product.findMany({
            orderBy: { name: 'asc' },
        });
        if (products.length === 0) {
            await ctx.reply('Товары отсутствуют.');
            return;
        }
        await ctx.reply('Выберите товар для редактирования:');
        for (const product of products) {
            const status = product.isActive ? '✅' : '❌';
            let productText = `${status} ${product.name}\n`;
            productText += `💰 Цена: ${product.price} BYN\n`;
            productText += `📦 Остаток: ${product.stock} шт.`;
            const buttons = telegraf_1.Markup.inlineKeyboard([
                [
                    telegraf_1.Markup.button.callback('💰 Изменить цену', `edit_price_${product.id}`),
                    telegraf_1.Markup.button.callback('📦 Изменить остаток', `edit_stock_${product.id}`),
                ],
                [
                    telegraf_1.Markup.button.callback(product.isActive ? '❌ Деактивировать' : '✅ Активировать', `toggle_${product.id}`),
                ],
            ]);
            await ctx.reply(productText, buttons);
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
    async onAcceptOrder(ctx) {
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
        const orderId = callbackQuery.data.replace('accept_', '');
        await this.handleOrderAction(ctx, orderId, 'ACCEPTED');
    }
    async onCancelOrder(ctx) {
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
        const orderId = callbackQuery.data.replace('cancel_', '');
        await this.handleOrderAction(ctx, orderId, 'CANCELLED');
    }
    async onCompleteOrder(ctx) {
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
        const orderId = callbackQuery.data.replace('complete_', '');
        await this.handleOrderAction(ctx, orderId, 'COMPLETED');
    }
    async onToggleProduct(ctx) {
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
        const productId = callbackQuery.data.replace('toggle_', '');
        await this.handleToggleProduct(ctx, productId);
    }
    async onAddStock(ctx) {
        await ctx.answerCbQuery('Функция в разработке');
    }
    async onRemoveStock(ctx) {
        await ctx.answerCbQuery('Функция в разработке');
    }
    async onEditPrice(ctx) {
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
        const productId = callbackQuery.data.replace('edit_price_', '');
        ctx.session.editingProduct = productId;
        ctx.session.editingField = 'price';
        await ctx.answerCbQuery();
        await ctx.reply('💰 Введите новую цену (например: 3.50):');
    }
    async onEditStock(ctx) {
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
        const productId = callbackQuery.data.replace('edit_stock_', '');
        ctx.session.editingProduct = productId;
        ctx.session.editingField = 'stock';
        await ctx.answerCbQuery();
        await ctx.reply('📦 Введите новое количество (например: 100):');
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
    (0, nestjs_telegraf_1.Action)(/^accept_/),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onAcceptOrder", null);
__decorate([
    (0, nestjs_telegraf_1.Action)(/^cancel_/),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onCancelOrder", null);
__decorate([
    (0, nestjs_telegraf_1.Action)(/^complete_/),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onCompleteOrder", null);
__decorate([
    (0, nestjs_telegraf_1.Action)(/^toggle_/),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onToggleProduct", null);
__decorate([
    (0, nestjs_telegraf_1.Action)(/^add_stock_/),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onAddStock", null);
__decorate([
    (0, nestjs_telegraf_1.Action)(/^remove_stock_/),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onRemoveStock", null);
__decorate([
    (0, nestjs_telegraf_1.Action)(/^edit_price_/),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onEditPrice", null);
__decorate([
    (0, nestjs_telegraf_1.Action)(/^edit_stock_/),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBotUpdate.prototype, "onEditStock", null);
exports.AdminBotUpdate = AdminBotUpdate = __decorate([
    (0, nestjs_telegraf_1.Update)(),
    __param(0, (0, nestjs_telegraf_1.InjectBot)('admin')),
    __metadata("design:paramtypes", [telegraf_1.Telegraf,
        prisma_service_1.PrismaService,
        admin_bot_service_1.AdminBotService,
        client_bot_service_1.ClientBotService])
], AdminBotUpdate);
//# sourceMappingURL=admin-bot.update.js.map