import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BotContext } from '../interfaces/bot-context.interface';

@Injectable()
export class BotLauncherService implements OnModuleInit {
  constructor(
    @InjectBot('client')
    private readonly clientBot: Telegraf<BotContext>,
    @InjectBot('admin')
    private readonly adminBot: Telegraf<BotContext>,
  ) {}

  async onModuleInit(): Promise<void> {
    console.log('Starting bots in polling mode...');

    // Запускаем боты асинхронно без ожидания
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

    // Graceful shutdown
    process.once('SIGINT', () => {
      this.clientBot.stop('SIGINT');
      this.adminBot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      this.clientBot.stop('SIGTERM');
      this.adminBot.stop('SIGTERM');
    });
  }
}
