import { Context as TelegrafContext } from 'telegraf';
export interface SessionData {
    cart?: Array<{
        productId: string;
        quantity: number;
    }>;
    orderStep?: string;
    phone?: string;
    address?: string;
    [key: string]: unknown;
}
export interface BotContext extends TelegrafContext {
    session: SessionData;
}
