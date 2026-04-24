"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nestjs_telegraf_1 = require("nestjs-telegraf");
const prisma_module_1 = require("./prisma/prisma.module");
const session_middleware_1 = require("./common/middleware/session.middleware");
const client_bot_module_1 = require("./client-bot/client-bot.module");
const admin_bot_module_1 = require("./admin-bot/admin-bot.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            nestjs_telegraf_1.TelegrafModule.forRootAsync({
                botName: 'client',
                useFactory: (config, sessionMiddleware) => ({
                    token: config.get('CLIENT_BOT_TOKEN') || '',
                    middlewares: [sessionMiddleware.middleware()],
                    launchOptions: {
                        webhook: {
                            domain: config.get('RENDER_BACKEND_URL') || '',
                            hookPath: '/webhook/client',
                        },
                    },
                }),
                inject: [config_1.ConfigService, session_middleware_1.SessionMiddleware],
            }),
            nestjs_telegraf_1.TelegrafModule.forRootAsync({
                botName: 'admin',
                useFactory: (config, sessionMiddleware) => ({
                    token: config.get('ADMIN_BOT_TOKEN') || '',
                    middlewares: [sessionMiddleware.middleware()],
                    launchOptions: {
                        webhook: {
                            domain: config.get('RENDER_BACKEND_URL') || '',
                            hookPath: '/webhook/admin',
                        },
                    },
                }),
                inject: [config_1.ConfigService, session_middleware_1.SessionMiddleware],
            }),
            client_bot_module_1.ClientBotModule,
            admin_bot_module_1.AdminBotModule,
        ],
        providers: [session_middleware_1.SessionMiddleware],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map