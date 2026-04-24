import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientBotService } from '../../client-bot/client-bot.service';

@Injectable()
export class OrderExpirationService implements OnModuleInit {
  private readonly logger = new Logger(OrderExpirationService.name);
  private readonly EXPIRATION_TIME_MS = 60 * 60 * 1000; // 60 минут

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientBotService: ClientBotService,
  ) {}

  onModuleInit() {
    // Запускаем проверку каждые 5 минут
    setInterval(() => this.checkExpiredOrders(), 5 * 60 * 1000);
    this.logger.log('[INIT] Order expiration service started');
  }

  private async checkExpiredOrders(): Promise<void> {
    const now = new Date();
    const expirationThreshold = new Date(now.getTime() - this.EXPIRATION_TIME_MS);

    this.logger.log(`[CHECK] Checking for orders older than ${expirationThreshold.toISOString()}`);

    try {
      // Находим все заказы со статусом PENDING, созданные более 60 минут назад
      const expiredOrders = await this.prisma.order.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: expirationThreshold,
          },
        },
        include: {
          user: true,
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      if (expiredOrders.length === 0) {
        this.logger.log('[CHECK] No expired orders found');
        return;
      }

      this.logger.log(`[EXPIRE] Found ${expiredOrders.length} expired orders`);

      for (const order of expiredOrders) {
        // Обновляем статус заказа на CANCELLED
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        });

        // Возвращаем товары на склад
        for (const item of order.orderItems) {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }

        this.logger.log(
          `[EXPIRE] Order ${order.id} cancelled due to expiration (created at ${order.createdAt.toISOString()})`,
        );

        // Уведомляем клиента
        try {
          await this.clientBotService.sendMessage(
            Number(order.user.telegramId),
            `❌ Ваш заказ #${order.id.slice(0, 8)} был автоматически отменен.\n\n` +
            `Причина: заказ не был обработан в течение 60 минут.\n` +
            `Товары возвращены на склад. Вы можете оформить новый заказ.`,
          );
          this.logger.log(`[EXPIRE] Notification sent to user ${order.user.telegramId} for order ${order.id}`);
        } catch (error) {
          this.logger.error(`[EXPIRE] Failed to notify user ${order.user.telegramId}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('[EXPIRE] Error checking expired orders:', error);
    }
  }
}
