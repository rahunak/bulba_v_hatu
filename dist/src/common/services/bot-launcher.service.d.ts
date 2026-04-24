import { OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { BotContext } from '../interfaces/bot-context.interface';
export declare class BotLauncherService implements OnModuleInit {
    private readonly clientBot;
    private readonly adminBot;
    constructor(clientBot: Telegraf<BotContext>, adminBot: Telegraf<BotContext>);
    onModuleInit(): Promise<void>;
}
