import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BotContext, SessionData } from '../interfaces/bot-context.interface';

@Injectable()
export class SessionMiddleware {
  private readonly logger = new Logger(SessionMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  middleware() {
    return async (ctx: BotContext, next: () => Promise<void>): Promise<void> => {
      const telegramId = ctx.from?.id.toString();

      if (!telegramId) {
        return next();
      }

      let sessionRecord = await this.prisma.session.findUnique({
        where: { telegramId },
      });

      if (!sessionRecord) {
        this.logger.log(`[SESSION] Creating new session for user ${telegramId}`);
        try {
          sessionRecord = await this.prisma.session.create({
            data: {
              telegramId,
              sessionData: {},
            },
          });
          this.logger.log(`[SESSION] Session created successfully for user ${telegramId}`);
        } catch (error: any) {
          if (error.code === 'P2002') {
            this.logger.warn(`[SESSION] Race condition detected for user ${telegramId}, fetching existing session`);
            sessionRecord = await this.prisma.session.findUnique({
              where: { telegramId },
            });
          } else {
            this.logger.error(`[SESSION] Failed to create session for user ${telegramId}:`, error);
            throw error;
          }
        }
      }

      ctx.session = (sessionRecord?.sessionData as SessionData) || {};

      await next();

      await this.prisma.session.update({
        where: { telegramId },
        data: {
          sessionData: ctx.session as object,
        },
      });
    };
  }
}
