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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionMiddleware = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let SessionMiddleware = class SessionMiddleware {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    middleware() {
        return async (ctx, next) => {
            const telegramId = ctx.from?.id.toString();
            if (!telegramId) {
                return next();
            }
            let sessionRecord = await this.prisma.session.findUnique({
                where: { telegramId },
            });
            if (!sessionRecord) {
                sessionRecord = await this.prisma.session.create({
                    data: {
                        telegramId,
                        sessionData: {},
                    },
                });
            }
            ctx.session = sessionRecord.sessionData || {};
            await next();
            await this.prisma.session.update({
                where: { telegramId },
                data: {
                    sessionData: ctx.session,
                },
            });
        };
    }
};
exports.SessionMiddleware = SessionMiddleware;
exports.SessionMiddleware = SessionMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SessionMiddleware);
//# sourceMappingURL=session.middleware.js.map