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
exports.AdminBotService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_telegraf_1 = require("nestjs-telegraf");
const telegraf_1 = require("telegraf");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminBotService = class AdminBotService {
    bot;
    prisma;
    constructor(bot, prisma) {
        this.bot = bot;
        this.prisma = prisma;
    }
    async notifyNewOrder(orderId) {
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
        if (!order)
            return;
        const admins = await this.prisma.user.findMany({
            where: { role: 'ADMIN' },
        });
        let orderText = `🔔 Новый заказ #${order.id.slice(0, 8)}\n\n`;
        orderText += `👤 Клиент: ${order.user.username || 'Без имени'}\n`;
        orderText += `📞 Телефон: ${order.user.phone || 'Не указан'}\n`;
        orderText += `📍 Адрес: ${order.address}\n\n`;
        orderText += `📦 Товары:\n`;
        for (const item of order.orderItems) {
            orderText += `- ${item.product.name} x${item.quantity} = ${Number(item.price) * item.quantity} BYN\n`;
        }
        orderText += `\n💰 Итого: ${order.totalAmount} BYN`;
        const buttons = telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.callback('✅ Принять', `accept_${orderId}`),
                telegraf_1.Markup.button.callback('❌ Отменить', `cancel_${orderId}`),
            ],
        ]);
        for (const admin of admins) {
            try {
                await this.bot.telegram.sendMessage(admin.telegramId, orderText, buttons);
            }
            catch (error) {
                console.error(`Failed to notify admin ${admin.telegramId}:`, error);
            }
        }
    }
    async sendMessage(chatId, text, extra) {
        await this.bot.telegram.sendMessage(chatId, text, extra);
    }
};
exports.AdminBotService = AdminBotService;
exports.AdminBotService = AdminBotService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_telegraf_1.InjectBot)('admin')),
    __metadata("design:paramtypes", [telegraf_1.Telegraf,
        prisma_service_1.PrismaService])
], AdminBotService);
//# sourceMappingURL=admin-bot.service.js.map