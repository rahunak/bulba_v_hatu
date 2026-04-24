import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { PrismaModule } from './prisma/prisma.module';
import { SessionModule } from './common/middleware/session.module';
import { SessionMiddleware } from './common/middleware/session.middleware';
import { ClientBotModule } from './client-bot/client-bot.module';
import { AdminBotModule } from './admin-bot/admin-bot.module';
import { BotLauncherService } from './common/services/bot-launcher.service';
import { OrderExpirationService } from './common/services/order-expiration.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SessionModule,
    TelegrafModule.forRootAsync({
      botName: 'client',
      useFactory: (config: ConfigService, sessionMiddleware: SessionMiddleware) => ({
        token: config.get<string>('CLIENT_BOT_TOKEN') || '',
        middlewares: [sessionMiddleware.middleware()],
        launchOptions: false,
        include: [ClientBotModule],
      }),
      inject: [ConfigService, SessionMiddleware],
    }),
    TelegrafModule.forRootAsync({
      botName: 'admin',
      useFactory: (config: ConfigService, sessionMiddleware: SessionMiddleware) => ({
        token: config.get<string>('ADMIN_BOT_TOKEN') || '',
        middlewares: [sessionMiddleware.middleware()],
        launchOptions: false,
        include: [AdminBotModule],
      }),
      inject: [ConfigService, SessionMiddleware],
    }),
    ClientBotModule,
    AdminBotModule,
  ],
  providers: [BotLauncherService, OrderExpirationService],
})
export class AppModule {}
