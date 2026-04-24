import { Module, Global } from '@nestjs/common';
import { SessionMiddleware } from './session.middleware';

@Global()
@Module({
  providers: [SessionMiddleware],
  exports: [SessionMiddleware],
})
export class SessionModule {}
