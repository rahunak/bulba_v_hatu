"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientBotModule = void 0;
const common_1 = require("@nestjs/common");
const client_bot_update_1 = require("./client-bot.update");
const client_bot_service_1 = require("./client-bot.service");
const admin_bot_module_1 = require("../admin-bot/admin-bot.module");
let ClientBotModule = class ClientBotModule {
};
exports.ClientBotModule = ClientBotModule;
exports.ClientBotModule = ClientBotModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => admin_bot_module_1.AdminBotModule)],
        providers: [client_bot_update_1.ClientBotUpdate, client_bot_service_1.ClientBotService],
        exports: [client_bot_service_1.ClientBotService],
    })
], ClientBotModule);
//# sourceMappingURL=client-bot.module.js.map