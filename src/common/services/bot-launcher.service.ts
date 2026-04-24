import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BotContext } from '../interfaces/bot-context.interface';

@Injectable()
export class BotLauncherService implements OnModuleInit {
  private readonly logger = new Logger(BotLauncherService.name);

  constructor(
    @InjectBot('client')
    private readonly clientBot: Telegraf<BotContext>,
    @InjectBot('admin')
    private readonly adminBot: Telegraf<BotContext>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('[STARTUP] Starting bots in polling mode...');

    // Запускаем боты асинхронно без ожидания
    this.clientBot.launch({
      dropPendingUpdates: true,
    }).then(() => {
      this.logger.log('[STARTUP] Client bot started successfully');
    }).catch((error) => {
      this.logger.error('[STARTUP] Failed to start client bot:', error);
    });

    this.adminBot.launch({
      dropPendingUpdates: true,
    }).then(() => {
      this.logger.log('[STARTUP] Admin bot started successfully');
    }).catch((error) => {
      this.logger.error('[STARTUP] Failed to start admin bot:', error);
    });

    // Graceful shutdown
    process.once('SIGINT', () => {
      this.logger.log('[SHUTDOWN] Received SIGINT, stopping bots...');
      this.clientBot.stop('SIGINT');
      this.adminBot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      this.logger.log('[SHUTDOWN] Received SIGTERM, stopping bots...');
      this.clientBot.stop('SIGTERM');
      this.adminBot.stop('SIGTERM');
    });
  }
}
