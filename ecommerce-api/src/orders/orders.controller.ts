import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import type { Order } from '@prisma/client';
import { OrderStatus } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { ListOrdersQuery } from './dto/list-orders.query';
import { OrderCancelResponseDto } from './dto/order-cancel-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  OrderResponseDto,
  PaginatedOrdersDto,
  RefundResponseDto,
} from './dto/order-response.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @ApiBearerAuth()
  @ApiOkResponse({ type: [OrderResponseDto] })
  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.orders.findForUser(user.uid);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ type: PaginatedOrdersDto })
  @UseGuards(AdminGuard)
  @Get()
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  findAll(@Query() query: ListOrdersQuery) {
    return this.orders.findAll(query);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ type: OrderResponseDto })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(id, user);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ type: OrderResponseDto })
  @UseGuards(AdminGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    return this.orders.updateStatus(id, dto.status);
  }

  @ApiBearerAuth()
  @ApiCreatedResponse({ type: RefundResponseDto })
  @UseGuards(AdminGuard)
  @Post(':id/refund')
  refund(@Param('id') id: string): Promise<{ refundId: string }> {
    return this.orders.refund(id);
  }

  // Owner or admin — no AdminGuard; ownership is enforced in the service.
  @ApiOkResponse({ type: OrderCancelResponseDto })
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderCancelResponseDto> {
    return this.orders.cancel(id, user);
  }
}
