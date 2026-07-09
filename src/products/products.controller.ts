import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Product } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { AuthUser } from '../auth/auth.types';
import { Public } from '../auth/public.decorator';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQuery } from './dto/list-products.query';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  PaginatedProducts,
  ProductsService,
  ProductWithRating,
} from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  findAll(
    @Query() query: ListProductsQuery,
    @Req() req: { user?: AuthUser },
  ): Promise<PaginatedProducts> {
    if (query.all && req.user?.admin !== true) {
      throw new ForbiddenException('Admin access required for all=true');
    }
    return this.products.findAll(query, query.all === true);
  }

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string): Promise<ProductWithRating> {
    return this.products.findBySlug(slug);
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateProductDto): Promise<Product> {
    return this.products.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch(':id/stock')
  adjustStock(
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ): Promise<Product> {
    return this.products.adjustStock(id, dto.delta);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.products.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  deactivate(@Param('id') id: string): Promise<Product> {
    return this.products.deactivate(id);
  }
}
