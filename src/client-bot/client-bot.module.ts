import { Module, forwardRef } from '@nestjs/common';
import { ClientBotUpdate } from './client-bot.update';
import { ClientBotService } from './client-bot.service';
import { AdminBotModule } from '../admin-bot/admin-bot.module';

@Module({
  imports: [forwardRef(() => AdminBotModule)],
  providers: [ClientBotUpdate, ClientBotService],
  exports: [ClientBotService],
})
export class ClientBotModule {}
