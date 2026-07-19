import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [MailModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
