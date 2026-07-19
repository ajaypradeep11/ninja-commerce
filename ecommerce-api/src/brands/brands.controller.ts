import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Brand } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { Public } from '../auth/public.decorator';
import { BrandsService } from './brands.service';
import { BrandResponseDto } from './dto/brand-response.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: [BrandResponseDto] })
  findAll(): Promise<Brand[]> {
    return this.brands.findAll();
  }

  @UseGuards(AdminGuard)
  @Post()
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: BrandResponseDto })
  create(@Body() dto: CreateBrandDto): Promise<Brand> {
    return this.brands.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BrandResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto): Promise<Brand> {
    return this.brands.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BrandResponseDto })
  remove(@Param('id') id: string): Promise<Brand> {
    return this.brands.remove(id);
  }
}
