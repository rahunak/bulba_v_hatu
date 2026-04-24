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
exports.ClientBotService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_telegraf_1 = require("nestjs-telegraf");
const telegraf_1 = require("telegraf");
let ClientBotService = class ClientBotService {
    bot;
    constructor(bot) {
        this.bot = bot;
    }
    async sendMessage(chatId, text, extra) {
        await this.bot.telegram.sendMessage(chatId, text, extra);
    }
    async sendOrderConfirmation(chatId, orderId) {
        await this.sendMessage(chatId, `✅ Ваш заказ #${orderId} принят!\n\nМы свяжемся с вами в ближайшее время для подтверждения.`);
    }
    async sendOrderStatusUpdate(chatId, orderId, status) {
        const statusText = {
            ACCEPTED: '✅ Ваш заказ принят в обработку',
            COMPLETED: '🎉 Ваш заказ выполнен',
            CANCELLED: '❌ Ваш заказ отменен',
        }[status] || 'Статус заказа изменен';
        await this.sendMessage(chatId, `Заказ #${orderId}: ${statusText}`);
    }
};
exports.ClientBotService = ClientBotService;
exports.ClientBotService = ClientBotService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_telegraf_1.InjectBot)('client')),
    __metadata("design:paramtypes", [telegraf_1.Telegraf])
], ClientBotService);
//# sourceMappingURL=client-bot.service.js.map