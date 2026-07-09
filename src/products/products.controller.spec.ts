import { ForbiddenException } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ListProductsQuery } from './dto/list-products.query';
import type { AuthUser } from '../auth/auth.types';

describe('ProductsController', () => {
  let service: { findAll: jest.Mock };
  let controller: ProductsController;

  beforeEach(() => {
    service = { findAll: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 }) };
    controller = new ProductsController(service as unknown as ProductsService);
  });

  it('findAll throws ForbiddenException when all=true and no user', () => {
    const query: ListProductsQuery = { all: true, page: 1, pageSize: 12 };
    expect(() => controller.findAll(query, {})).toThrow(ForbiddenException);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('findAll throws ForbiddenException when all=true and non-admin user', () => {
    const query: ListProductsQuery = { all: true, page: 1, pageSize: 12 };
    const user: AuthUser = { uid: 'u1', email: 'a@b.com', admin: false };
    expect(() => controller.findAll(query, { user })).toThrow(ForbiddenException);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('findAll delegates to service.findAll(query, true) when all=true and admin user', async () => {
    const query: ListProductsQuery = { all: true, page: 1, pageSize: 12 };
    const user: AuthUser = { uid: 'u1', email: 'a@b.com', admin: true };
    await controller.findAll(query, { user });
    expect(service.findAll).toHaveBeenCalledWith(query, true);
  });

  it('findAll delegates to service.findAll(query, false) when no all and no user', async () => {
    const query: ListProductsQuery = { page: 1, pageSize: 12 };
    await controller.findAll(query, {});
    expect(service.findAll).toHaveBeenCalledWith(query, false);
  });
});
