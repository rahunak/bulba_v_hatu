import { PrismaService } from '../../prisma/prisma.service';
import { BotContext } from '../interfaces/bot-context.interface';
export declare class SessionMiddleware {
    private readonly prisma;
    constructor(prisma: PrismaService);
    middleware(): (ctx: BotContext, next: () => Promise<void>) => Promise<void>;
}
