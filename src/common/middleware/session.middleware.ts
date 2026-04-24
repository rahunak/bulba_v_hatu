import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BotContext, SessionData } from '../interfaces/bot-context.interface';

@Injectable()
export class SessionMiddleware {
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
        try {
          sessionRecord = await this.prisma.session.create({
            data: {
              telegramId,
              sessionData: {},
            },
          });
        } catch (error: any) {
          if (error.code === 'P2002') {
            sessionRecord = await this.prisma.session.findUnique({
              where: { telegramId },
            });
          } else {
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
