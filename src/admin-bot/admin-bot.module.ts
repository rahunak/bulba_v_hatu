import { Module, forwardRef } from '@nestjs/common';
import { AdminBotUpdate } from './admin-bot.update';
import { AdminBotService } from './admin-bot.service';
import { ClientBotModule } from '../client-bot/client-bot.module';

@Module({
  imports: [forwardRef(() => ClientBotModule)],
  providers: [AdminBotUpdate, AdminBotService],
  exports: [AdminBotService],
})
export class AdminBotModule {}
