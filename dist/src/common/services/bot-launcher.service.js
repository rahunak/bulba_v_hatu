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
exports.BotLauncherService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_telegraf_1 = require("nestjs-telegraf");
const telegraf_1 = require("telegraf");
let BotLauncherService = class BotLauncherService {
    clientBot;
    adminBot;
    constructor(clientBot, adminBot) {
        this.clientBot = clientBot;
        this.adminBot = adminBot;
    }
    async onModuleInit() {
        console.log('Starting bots in polling mode...');
        this.clientBot.launch({
            dropPendingUpdates: true,
        }).then(() => {
            console.log('Client bot started successfully');
        }).catch((error) => {
            console.error('Failed to start client bot:', error);
        });
        this.adminBot.launch({
            dropPendingUpdates: true,
        }).then(() => {
            console.log('Admin bot started successfully');
        }).catch((error) => {
            console.error('Failed to start admin bot:', error);
        });
        process.once('SIGINT', () => {
            this.clientBot.stop('SIGINT');
            this.adminBot.stop('SIGINT');
        });
        process.once('SIGTERM', () => {
            this.clientBot.stop('SIGTERM');
            this.adminBot.stop('SIGTERM');
        });
    }
};
exports.BotLauncherService = BotLauncherService;
exports.BotLauncherService = BotLauncherService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_telegraf_1.InjectBot)('client')),
    __param(1, (0, nestjs_telegraf_1.InjectBot)('admin')),
    __metadata("design:paramtypes", [telegraf_1.Telegraf,
        telegraf_1.Telegraf])
], BotLauncherService);
//# sourceMappingURL=bot-launcher.service.js.map