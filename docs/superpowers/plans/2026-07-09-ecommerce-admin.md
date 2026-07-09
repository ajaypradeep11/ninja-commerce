# Ecommerce Admin Portal (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ecommerce-admin`, a React SPA for managing products, categories, and orders against the existing `ecommerce-api`, plus the small API prep that makes a generated typed client possible.

**Architecture:** Part A adds OpenAPI response schemas, an admin stats endpoint, admin product fetch-by-ID, an orders email filter, an `openapi.json` emit script, and Firebase-emulator support to `ecommerce-api`. Part B scaffolds the Vite SPA: Firebase Auth (emulator) with the `admin` custom claim gating everything, a generated `@hey-api/openapi-ts` client wrapped in TanStack Query hooks, and shadcn/ui pages for dashboard/products/categories/orders.

**Tech Stack:** React 19, Vite, TypeScript strict, Tailwind v4, shadcn/ui, React Router v7 (library mode), TanStack Query v5, react-hook-form + zod, dnd-kit, Firebase JS SDK (Auth + Storage emulators), @hey-api/openapi-ts, Vitest + Testing Library. API side: NestJS 11, @nestjs/swagger CLI plugin.

**Spec:** `/Users/ajaypradeepm/Work/Ecommerce/docs/superpowers/specs/2026-07-09-ecommerce-admin-design.md`

## Global Constraints

- Two repos are touched. Tasks 1–6 commit to `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-api` (existing repo). Tasks 7–16 commit to `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-admin` (new repo created in Task 7). Never commit to the meta repo.
- All prices are **integer cents** end-to-end. The admin UI shows/accepts dollars and converts at the form boundary (`src/lib/money.ts`).
- TypeScript strict mode in both repos. TDD: every task with logic writes the failing test first. Commit at the end of every task.
- Firebase emulator project ID is `demo-ecommerce` everywhere (API env, emulator start command, admin env). Seeded admin login: `admin@example.com` / `password123`.
- Admin dev server: `http://localhost:5174` (strictPort). API dev server on this machine: `PORT=3002` (3001 is occupied by an unrelated process; `.env` default stays 3001 for portability).
- Auth + Storage emulators: ports 9099 and 9199; emulator UI on 4000. `firebase.json` lives in `ecommerce-admin`.
- Admin claim: Firebase custom claim `admin: true`. The API's `AdminGuard` and the SPA's `RequireAdmin` both key off it.
- API unit tests mock `PrismaService`/`FirebaseService`/`StripeService` (existing pattern — see `src/products/products.service.spec.ts` siblings). Admin tests mock the generated client and Firebase; no network.
- `npm run lint` in ecommerce-api auto-fixes; don't run it casually.
- In ecommerce-api, use `import type` for types used only in decorated signatures (isolatedModules + emitDecoratorMetadata).

---

## Part A — API prep (`ecommerce-api`)

### Task 1: Swagger CLI plugin, shared document builder, product & category response DTOs

**Files:**
- Modify: `nest-cli.json`
- Create: `src/swagger.ts`
- Modify: `src/main.ts` (use shared builder)
- Create: `src/categories/dto/category-response.dto.ts`
- Create: `src/products/dto/product-response.dto.ts`
- Modify: `src/products/products.controller.ts`, `src/categories/categories.controller.ts` (response decorators)

**Interfaces:**
- Produces: `buildSwaggerDocument(app: INestApplication): OpenAPIObject` in `src/swagger.ts` (consumed by Task 5's emit script); OpenAPI schemas named `CategoryResponseDto`, `ProductResponseDto`, `PaginatedProductsDto` (consumed by the generated client in Task 10).
- The CLI plugin only runs during `nest build` / `nest start` — NOT under ts-jest or ts-node. Nothing at runtime or in tests may depend on the generated `@ApiProperty` metadata.

- [ ] **Step 1: Enable the Swagger CLI plugin**

`nest-cli.json`:
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": { "introspectComments": true }
      }
    ]
  }
}
```

- [ ] **Step 2: Extract the shared Swagger builder**

Create `src/swagger.ts`:
```ts
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Ecommerce API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
```

Modify `src/main.ts` — replace the inline DocumentBuilder block:
```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildSwaggerDocument } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGINS').split(','),
  });

  SwaggerModule.setup('docs', app, buildSwaggerDocument(app));

  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
```

- [ ] **Step 3: Create category and product response DTOs**

Create `src/categories/dto/category-response.dto.ts`:
```ts
export class CategoryResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  sortOrder!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
```

Create `src/products/dto/product-response.dto.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '../../categories/dto/category-response.dto';

export class ProductResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  description!: string;
  priceCents!: number;
  images!: string[];
  stockQty!: number;
  active!: boolean;
  categoryId!: string;
  createdAt!: Date;
  updatedAt!: Date;
  @ApiProperty({ type: Number, nullable: true })
  averageRating!: number | null;
  reviewCount!: number;
  @ApiProperty({ type: CategoryResponseDto, required: false })
  category?: CategoryResponseDto;
}

export class PaginatedProductsDto {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: ProductResponseDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}
```

(The CLI plugin auto-annotates plain properties in `*.dto.ts` files; explicit `@ApiProperty` is only needed for nullable/optional-relation cases as above.)

- [ ] **Step 4: Decorate the controllers**

In `src/products/products.controller.ts`, add imports and response decorators (method bodies unchanged):
```ts
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { PaginatedProductsDto, ProductResponseDto } from './dto/product-response.dto';
```
- `findAll`: `@ApiOkResponse({ type: PaginatedProductsDto })`
- `findBySlug`: `@ApiOkResponse({ type: ProductResponseDto })`
- `create`: `@ApiBearerAuth()` + `@ApiCreatedResponse({ type: ProductResponseDto })`
- `adjustStock`, `update`, `deactivate`: `@ApiBearerAuth()` + `@ApiOkResponse({ type: ProductResponseDto })`

In `src/categories/categories.controller.ts`:
```ts
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CategoryResponseDto } from './dto/category-response.dto';
```
- `findAll`: `@ApiOkResponse({ type: [CategoryResponseDto] })`
- `create`: `@ApiBearerAuth()` + `@ApiCreatedResponse({ type: CategoryResponseDto })`
- `update`, `remove`: `@ApiBearerAuth()` + `@ApiOkResponse({ type: CategoryResponseDto })`

- [ ] **Step 5: Verify build and tests**

Run: `cd /Users/ajaypradeepm/Work/Ecommerce/ecommerce-api && npm run build && npm test`
Expected: build clean, all 53 unit tests pass.

- [ ] **Step 6: Verify schemas appear in Swagger**

Run: `PORT=3098 npm run start:dev` briefly, then `curl -s http://localhost:3098/docs-json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=Object.keys(JSON.parse(d).components.schemas);console.log(s.join('\n'))})"`
Expected: list includes `ProductResponseDto`, `PaginatedProductsDto`, `CategoryResponseDto`, `CreateProductDto`, `UpdateProductDto`, `CreateCategoryDto`. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: swagger CLI plugin + product/category response schemas"
```

---

### Task 2: Admin product fetch-by-ID (`GET /products/id/:id`)

**Files:**
- Modify: `src/products/products.service.ts`
- Modify: `src/products/products.service.spec.ts`
- Modify: `src/products/products.controller.ts`

**Interfaces:**
- Consumes: `ProductsService.withRatings` (existing private helper), `ProductResponseDto` (Task 1).
- Produces: `ProductsService.findByIdAdmin(id: string): Promise<ProductWithRating>` — returns the product regardless of `active`, with `category`, `averageRating`, `reviewCount`; throws `NotFoundException` when missing. Route `GET /products/id/:id` (AdminGuard). No route conflict with `GET /products/:slug`: `id/:id` is two segments.

- [ ] **Step 1: Write the failing service tests**

Add to `src/products/products.service.spec.ts` (follow the file's existing mock style — a `prisma` mock object with jest.fn methods):
```ts
describe('findByIdAdmin', () => {
  it('returns an inactive product with rating aggregates', async () => {
    const product = {
      id: 'p1',
      name: 'Tee',
      slug: 'tee',
      active: false,
      category: { id: 'c1' },
    };
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.review.groupBy.mockResolvedValue([
      { productId: 'p1', _avg: { rating: 4 }, _count: { rating: 2 } },
    ]);

    const result = await service.findByIdAdmin('p1');

    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      include: { category: true },
    });
    expect(result.averageRating).toBe(4);
    expect(result.reviewCount).toBe(2);
    expect(result.active).toBe(false);
  });

  it('throws NotFoundException when the product does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.findByIdAdmin('nope')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest products.service.spec -t findByIdAdmin`
Expected: FAIL — `service.findByIdAdmin is not a function`.

- [ ] **Step 3: Implement the service method**

Add to `ProductsService` (after `findBySlug`):
```ts
async findByIdAdmin(id: string): Promise<ProductWithRating> {
  const product = await this.prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!product) throw new NotFoundException('Product not found');
  const [withRating] = await this.withRatings([product]);
  return withRating;
}
```

- [ ] **Step 4: Add the controller route**

In `src/products/products.controller.ts`, add ABOVE `findBySlug` (clarity, not correctness):
```ts
@UseGuards(AdminGuard)
@ApiBearerAuth()
@ApiOkResponse({ type: ProductResponseDto })
@Get('id/:id')
findByIdAdmin(@Param('id') id: string): Promise<ProductWithRating> {
  return this.products.findByIdAdmin(id);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: admin product fetch-by-id including inactive"
```

---

### Task 3: Orders — email filter and response DTOs

**Files:**
- Modify: `src/orders/dto/list-orders.query.ts`
- Modify: `src/orders/orders.service.ts`
- Modify: `src/orders/orders.service.spec.ts`
- Create: `src/orders/dto/order-response.dto.ts`
- Modify: `src/orders/orders.controller.ts`

**Interfaces:**
- Produces: `ListOrdersQuery.email?: string` — case-insensitive `contains` filter; OpenAPI schemas `OrderResponseDto`, `OrderItemResponseDto`, `PaginatedOrdersDto`, `RefundResponseDto` (consumed by Task 10's generated client; the orders/dashboard pages rely on these exact names).

- [ ] **Step 1: Write the failing service test**

Add to `src/orders/orders.service.spec.ts`:
```ts
it('filters by email case-insensitively', async () => {
  prisma.order.findMany.mockResolvedValue([]);
  prisma.order.count.mockResolvedValue(0);

  await service.findAll({ email: 'Buyer@', page: 1, pageSize: 20 });

  expect(prisma.order.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { email: { contains: 'Buyer@', mode: 'insensitive' } },
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest orders.service.spec -t "filters by email"`
Expected: FAIL — `where` was `{}`.

- [ ] **Step 3: Implement**

`src/orders/dto/list-orders.query.ts` — add:
```ts
@IsOptional()
@IsString()
email?: string;
```
(add `IsString` to the class-validator import.)

`src/orders/orders.service.ts` — in `findAll`, replace the `where` construction:
```ts
const { status, email, page = 1, pageSize = 20 } = query;
const where: Prisma.OrderWhereInput = {
  ...(status ? { status } : {}),
  ...(email ? { email: { contains: email, mode: 'insensitive' as const } } : {}),
};
```
(import `Prisma` from `@prisma/client`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest orders.service.spec`
Expected: PASS.

- [ ] **Step 5: Create order response DTOs**

Create `src/orders/dto/order-response.dto.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderItemResponseDto {
  id!: string;
  orderId!: string;
  productId!: string;
  name!: string;
  priceCents!: number;
  quantity!: number;
}

export class OrderResponseDto {
  id!: string;
  userId!: string;
  email!: string;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;
  @ApiProperty({ type: String, nullable: true })
  stripeSessionId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  stripePaymentIntentId!: string | null;
  @ApiProperty({ type: Object, nullable: true })
  shippingAddress!: unknown;
  subtotalCents!: number;
  @ApiProperty({ type: Number, nullable: true })
  totalCents!: number | null;
  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedOrdersDto {
  @ApiProperty({ type: [OrderResponseDto] })
  items!: OrderResponseDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}

export class RefundResponseDto {
  refundId!: string;
}
```

- [ ] **Step 6: Decorate the orders controller**

In `src/orders/orders.controller.ts`:
```ts
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  OrderResponseDto,
  PaginatedOrdersDto,
  RefundResponseDto,
} from './dto/order-response.dto';
```
- `findMine`: `@ApiBearerAuth()` + `@ApiOkResponse({ type: [OrderResponseDto] })`
- `findAll`: `@ApiBearerAuth()` + `@ApiOkResponse({ type: PaginatedOrdersDto })`
- `findOne`: `@ApiBearerAuth()` + `@ApiOkResponse({ type: OrderResponseDto })`
- `updateStatus`: `@ApiBearerAuth()` + `@ApiOkResponse({ type: OrderResponseDto })`
- `refund`: `@ApiBearerAuth()` + `@ApiCreatedResponse({ type: RefundResponseDto })`

- [ ] **Step 7: Verify build + full tests, commit**

Run: `npm run build && npm test`
Expected: clean build, all tests pass.

```bash
git add -A && git commit -m "feat: orders email filter + order response schemas"
```

---

### Task 4: Admin stats endpoint (`GET /admin/stats`)

**Files:**
- Create: `src/admin/dto/admin-stats.dto.ts`
- Create: `src/admin/admin.service.ts`
- Create: `src/admin/admin.service.spec.ts`
- Create: `src/admin/admin.controller.ts`
- Create: `src/admin/admin.module.ts`
- Modify: `src/app.module.ts` (register `AdminModule`)

**Interfaces:**
- Produces: `GET /admin/stats` (AdminGuard) → `AdminStatsDto { ordersToday: number; lowStockProducts: LowStockProductDto[] }` where `LowStockProductDto = { id, name, slug, stockQty }`. "Orders today" = `createdAt >= UTC midnight` AND `status NOT IN (PENDING, CANCELLED)`. "Low stock" = active products with `stockQty <= 5` (exported constant `LOW_STOCK_THRESHOLD`), ascending by stock.

- [ ] **Step 1: Write the failing service test**

Create `src/admin/admin.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService, LOW_STOCK_THRESHOLD } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  const prisma = {
    order: { count: jest.fn() },
    product: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AdminService);
  });

  it('counts paid-or-later orders since UTC midnight and lists low-stock products', async () => {
    prisma.order.count.mockResolvedValue(3);
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Tee', slug: 'tee', stockQty: 2 },
    ]);

    const stats = await service.stats();

    const orderArgs = prisma.order.count.mock.calls[0][0];
    expect(orderArgs.where.status).toEqual({ notIn: ['PENDING', 'CANCELLED'] });
    const gte: Date = orderArgs.where.createdAt.gte;
    expect(gte.getUTCHours()).toBe(0);
    expect(gte.getUTCMinutes()).toBe(0);

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { active: true, stockQty: { lte: LOW_STOCK_THRESHOLD } },
      select: { id: true, name: true, slug: true, stockQty: true },
      orderBy: { stockQty: 'asc' },
    });
    expect(stats).toEqual({
      ordersToday: 3,
      lowStockProducts: [{ id: 'p1', name: 'Tee', slug: 'tee', stockQty: 2 }],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest admin.service.spec`
Expected: FAIL — cannot find module `./admin.service`.

- [ ] **Step 3: Implement DTO, service, controller, module**

Create `src/admin/dto/admin-stats.dto.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';

export class LowStockProductDto {
  id!: string;
  name!: string;
  slug!: string;
  stockQty!: number;
}

export class AdminStatsDto {
  ordersToday!: number;
  @ApiProperty({ type: [LowStockProductDto] })
  lowStockProducts!: LowStockProductDto[];
}
```

Create `src/admin/admin.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminStatsDto } from './dto/admin-stats.dto';

export const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(): Promise<AdminStatsDto> {
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const [ordersToday, lowStockProducts] = await Promise.all([
      this.prisma.order.count({
        where: {
          createdAt: { gte: startOfTodayUtc },
          status: { notIn: ['PENDING', 'CANCELLED'] },
        },
      }),
      this.prisma.product.findMany({
        where: { active: true, stockQty: { lte: LOW_STOCK_THRESHOLD } },
        select: { id: true, name: true, slug: true, stockQty: true },
        orderBy: { stockQty: 'asc' },
      }),
    ]);
    return { ordersToday, lowStockProducts };
  }
}
```

Create `src/admin/admin.controller.ts`:
```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';
import { AdminStatsDto } from './dto/admin-stats.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AdminStatsDto })
  @Get('stats')
  stats(): Promise<AdminStatsDto> {
    return this.admin.stats();
  }
}
```

Create `src/admin/admin.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

Register in `src/app.module.ts`: add `AdminModule` to the imports array (`import { AdminModule } from './admin/admin.module';`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites, including the new one).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: admin stats endpoint (orders today, low stock)"
```

---

### Task 5: OpenAPI emit script

**Files:**
- Create: `src/emit-openapi.ts`
- Modify: `package.json` (script)
- Modify: `.gitignore` — do NOT ignore `openapi.json` (it is committed so the admin repo can generate without running the API)

**Interfaces:**
- Consumes: `buildSwaggerDocument` (Task 1).
- Produces: `npm run openapi:emit` → writes `openapi.json` at the repo root. Runs `nest build` first so the Swagger CLI plugin annotates DTOs (ts-node would silently produce empty schemas — that is why the script lives in `src/` and runs from `dist/`). Requires a populated `.env` (ConfigModule validation) but NOT a running database — lifecycle hooks never run because the app is never initialized/listened.

- [ ] **Step 1: Create the emit script**

Create `src/emit-openapi.ts`:
```ts
/**
 * Emits openapi.json at the repo root.
 * Must run from compiled output so the @nestjs/swagger CLI plugin has
 * annotated the DTOs: `npm run openapi:emit` (never plain ts-node).
 */
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { buildSwaggerDocument } from './swagger';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildSwaggerDocument(app);
  const outPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n');
  await app.close();
  console.log(`Wrote ${outPath}`);
}
void main();
```

Add to `package.json` scripts:
```json
"openapi:emit": "nest build && node dist/emit-openapi.js"
```

- [ ] **Step 2: Run it and inspect the output**

Run: `npm run openapi:emit && node -e "const s=require('./openapi.json');console.log(Object.keys(s.components.schemas).sort().join('\n'));console.log('paths:',Object.keys(s.paths).length)"`
Expected: schema list includes `AdminStatsDto`, `CategoryResponseDto`, `CreateCategoryDto`, `CreateProductDto`, `LowStockProductDto`, `OrderItemResponseDto`, `OrderResponseDto`, `PaginatedOrdersDto`, `PaginatedProductsDto`, `ProductResponseDto`, `RefundResponseDto`, `UpdateOrderStatusDto`, `UpdateProductDto`; paths ≥ 20. Verify `GET /products` request query params include `all`, and `GET /orders` includes `email`.

- [ ] **Step 3: Verify tests still pass and commit (including `openapi.json`)**

Run: `npm test`
Expected: PASS.

```bash
git add -A && git commit -m "feat: openapi.json emit script"
```

---

### Task 6: Firebase emulator support + demo seed data

**Files:**
- Modify: `scripts/grant-admin.ts`
- Create: `scripts/seed-emulator-admin.ts`
- Create: `scripts/seed-demo-data.ts`
- Modify: `src/products/dto/create-product.dto.ts` (allow localhost image URLs)
- Modify: `package.json`, `.env`, `.env.example`, `README.md`

**Interfaces:**
- Produces: `npm run seed:emulator` → emulator user `admin@example.com` / `password123` with `admin: true` claim; `npm run seed:demo` → 2 categories, 3 products (one low-stock), 1 user, 2 orders (PAID + SHIPPED) so the admin UI has data; API verifies emulator tokens when `FIREBASE_AUTH_EMULATOR_HOST` is set (native firebase-admin behavior — config only).
- ConfigModule's Joi validation uses `allowUnknown: true` by default, so the new env var needs no schema change.

- [ ] **Step 1: Make grant-admin emulator-aware**

In `scripts/grant-admin.ts`, replace the `initializeApp` call:
```ts
const app = initializeApp(
  process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? { projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-ecommerce' }
    : { credential: applicationDefault() },
);
```

- [ ] **Step 2: Create the emulator admin seed script**

Create `scripts/seed-emulator-admin.ts`:
```ts
/**
 * Creates/updates the admin user in the Firebase Auth emulator.
 * The emulator must be running (see ecommerce-admin: `npm run emulators`).
 *
 * Usage: npm run seed:emulator
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const EMAIL = 'admin@example.com';
const PASSWORD = 'password123';

async function main(): Promise<void> {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  const app = initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-ecommerce',
  });
  const auth = getAuth(app);
  const user = await auth
    .getUserByEmail(EMAIL)
    .catch(() => auth.createUser({ email: EMAIL, password: PASSWORD }));
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`Emulator admin ready: ${EMAIL} / ${PASSWORD} (uid ${user.uid})`);
}

void main();
```

- [ ] **Step 3: Create the demo data seed script**

Create `scripts/seed-demo-data.ts`:
```ts
/**
 * Seeds demo catalog + orders into the local dev database so the admin UI
 * has data to show. Idempotent via upserts on slugs/ids.
 *
 * Usage: npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tees = await prisma.category.upsert({
    where: { slug: 'tees' },
    update: {},
    create: { name: 'Tees', slug: 'tees', sortOrder: 0 },
  });
  const hoodies = await prisma.category.upsert({
    where: { slug: 'hoodies' },
    update: {},
    create: { name: 'Hoodies', slug: 'hoodies', sortOrder: 1 },
  });

  const tee = await prisma.product.upsert({
    where: { slug: 'organic-cotton-tee' },
    update: {},
    create: {
      name: 'Organic Cotton Tee',
      slug: 'organic-cotton-tee',
      description: 'Soft, breathable, 100% organic cotton.',
      priceCents: 2900,
      images: [],
      stockQty: 40,
      categoryId: tees.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'heavyweight-hoodie' },
    update: {},
    create: {
      name: 'Heavyweight Hoodie',
      slug: 'heavyweight-hoodie',
      description: 'Brushed fleece interior, relaxed fit.',
      priceCents: 7900,
      images: [],
      stockQty: 3, // low stock on purpose (threshold is 5)
      categoryId: hoodies.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'retired-crewneck' },
    update: {},
    create: {
      name: 'Retired Crewneck',
      slug: 'retired-crewneck',
      description: 'Discontinued colourway.',
      priceCents: 5900,
      images: [],
      stockQty: 0,
      active: false,
      categoryId: hoodies.id,
    },
  });

  await prisma.user.upsert({
    where: { id: 'demo-buyer-uid' },
    update: {},
    create: { id: 'demo-buyer-uid', email: 'buyer@example.com' },
  });

  await prisma.order.upsert({
    where: { stripeSessionId: 'demo_session_paid' },
    update: {},
    create: {
      userId: 'demo-buyer-uid',
      email: 'buyer@example.com',
      status: 'PAID',
      stripeSessionId: 'demo_session_paid',
      stripePaymentIntentId: 'demo_pi_paid',
      shippingAddress: {
        name: 'Demo Buyer',
        line1: '1 Main St',
        city: 'Springfield',
        postal_code: '01101',
        country: 'US',
      },
      subtotalCents: 5800,
      totalCents: 5800,
      items: {
        create: [
          { productId: tee.id, name: tee.name, priceCents: 2900, quantity: 2 },
        ],
      },
    },
  });
  await prisma.order.upsert({
    where: { stripeSessionId: 'demo_session_shipped' },
    update: {},
    create: {
      userId: 'demo-buyer-uid',
      email: 'buyer@example.com',
      status: 'SHIPPED',
      stripeSessionId: 'demo_session_shipped',
      stripePaymentIntentId: 'demo_pi_shipped',
      shippingAddress: {
        name: 'Demo Buyer',
        line1: '1 Main St',
        city: 'Springfield',
        postal_code: '01101',
        country: 'US',
      },
      subtotalCents: 2900,
      totalCents: 2900,
      items: {
        create: [
          { productId: tee.id, name: tee.name, priceCents: 2900, quantity: 1 },
        ],
      },
    },
  });

  console.log('Demo data seeded.');
}

void main().finally(() => prisma.$disconnect());
```

Add to `package.json` scripts:
```json
"seed:emulator": "ts-node scripts/seed-emulator-admin.ts",
"seed:demo": "ts-node scripts/seed-demo-data.ts"
```

- [ ] **Step 4: Allow localhost image URLs**

The Storage emulator returns `http://127.0.0.1:9199/...` download URLs; `@IsUrl` with default `require_tld` rejects `localhost`-style hosts. In `src/products/dto/create-product.dto.ts` change the images validator:
```ts
@IsArray()
@IsUrl({ require_tld: false }, { each: true })
images!: string[];
```
(`UpdateProductDto` inherits via `PartialType`.)

- [ ] **Step 5: Update env files and README**

`.env` — set for this machine's dev loop:
```
FIREBASE_PROJECT_ID=demo-ecommerce
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174
```
`.env.example` — add the two lines with comments:
```
# Set to use the local Firebase Auth emulator (leave unset in production)
FIREBASE_AUTH_EMULATOR_HOST=
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174
```
`README.md` — add a "Local admin development" section: start emulators from `../ecommerce-admin` (`npm run emulators`), then `npm run seed:emulator`, `npm run seed:demo`, `PORT=3002 npm run start:dev`.

- [ ] **Step 6: Verify tests, build, commit**

Run: `npm run build && npm test`
Expected: clean, all pass. (Emulator scripts are exercised in Task 9 once the emulator exists.)

```bash
git add -A && git commit -m "feat: firebase emulator support + demo seed scripts"
```

---

## Part B — Admin SPA (`ecommerce-admin`)

### Task 7: Scaffold the admin app

**Files:**
- Create: `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-admin` (Vite react-ts scaffold, own git repo)
- Modify: `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `src/index.css`, `package.json`
- Create: `.env.development`, `.env.example`, `firebase.json`, `storage.rules`, `src/setupTests.ts`, `.prettierrc`

**Interfaces:**
- Produces: dev server on `http://localhost:5174`; `@/*` path alias; Tailwind v4 + shadcn/ui initialized with these components available: button, card, dialog, alert-dialog, input, label, select, switch, table, textarea, badge, sonner, form, dropdown-menu, separator; Vitest configured (jsdom, globals, `src/setupTests.ts`); Firebase emulator config (`npm run emulators`).

- [ ] **Step 1: Scaffold and install**

```bash
cd /Users/ajaypradeepm/Work/Ecommerce
npm create vite@latest ecommerce-admin -- --template react-ts
cd ecommerce-admin
npm install
git init && git add -A && git commit -m "chore: vite react-ts scaffold"
npm i tailwindcss @tailwindcss/vite react-router @tanstack/react-query firebase react-hook-form zod @hookform/resolvers @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm i -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/node @hey-api/openapi-ts prettier
```

- [ ] **Step 2: Configure Vite, TypeScript paths, Tailwind, Vitest**

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5174, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
```

Add to BOTH `tsconfig.json` and `tsconfig.app.json` `compilerOptions`:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```
Also add `"types": ["vitest/globals", "@testing-library/jest-dom"]` to `tsconfig.app.json` compilerOptions.

Replace `src/index.css` content with:
```css
@import "tailwindcss";
```
Delete `src/App.css` and its import in `src/App.tsx` (App.tsx gets fully replaced in Task 10).

Create `src/setupTests.ts`:
```ts
import '@testing-library/jest-dom/vitest';

// jsdom lacks APIs Radix UI primitives (Select, dnd) rely on.
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.releasePointerCapture = () => {};
```

Create `.prettierrc`:
```json
{ "singleQuote": true, "trailingComma": "all" }
```

- [ ] **Step 3: Initialize shadcn/ui and add components**

```bash
npx shadcn@latest init -y -b neutral
npx shadcn@latest add -y button card dialog alert-dialog input label select switch table textarea badge sonner form dropdown-menu separator
```
(If `init` complains about detection, it needs the alias config from Step 2 in place first.)

- [ ] **Step 4: Env files and Firebase emulator config**

`.env.development`:
```
VITE_API_URL=http://localhost:3002
VITE_FIREBASE_API_KEY=fake-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-ecommerce.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-ecommerce
VITE_FIREBASE_STORAGE_BUCKET=demo-ecommerce.appspot.com
VITE_USE_EMULATORS=true
```
`.env.example`: same keys, values blank except `VITE_USE_EMULATORS=false`.

`firebase.json`:
```json
{
  "storage": { "rules": "storage.rules" },
  "emulators": {
    "auth": { "port": 9099 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

`storage.rules` (emulator/dev only — locked down before any real deployment):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"format": "prettier --write src",
"generate:api": "openapi-ts",
"emulators": "firebase emulators:start --project demo-ecommerce"
```

- [ ] **Step 5: Verify dev server and tests run**

Run: `npm run build` (expect clean), `npm test` (expect "no test files found" exit 0 — pass `--passWithNoTests` if vitest errors; add that flag to the script if needed).
Run `npm run dev` briefly; expect Vite on 5174.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: tailwind4 + shadcn + router + query + vitest scaffold"
```

---

### Task 8: Pure utility modules (TDD)

**Files:**
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`
- Create: `src/lib/slugify.ts`, `src/lib/slugify.test.ts`
- Create: `src/lib/order-actions.ts`, `src/lib/order-actions.test.ts`

**Interfaces:**
- Produces (consumed by every later page task):
  - `formatUsd(cents: number): string` — `2900 → "$29.00"`
  - `centsToDollars(cents: number): string` — `2900 → "29.00"`
  - `dollarsToCents(value: string): number | null` — `"29" → 2900`, `"29.5" → 2950`, `"29.99" → 2999`, invalid → `null`
  - `slugify(value: string): string` — kebab-case matching the API's `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
  - `type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'`
  - `availableOrderActions(status: OrderStatus): { nextStatus: 'SHIPPED' | 'DELIVERED' | null; canRefund: boolean }`

- [ ] **Step 1: Write the failing tests**

`src/lib/money.test.ts`:
```ts
import { centsToDollars, dollarsToCents, formatUsd } from './money';

describe('formatUsd', () => {
  it('formats cents as USD', () => {
    expect(formatUsd(2900)).toBe('$29.00');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(123456)).toBe('$1,234.56');
  });
});

describe('centsToDollars', () => {
  it('renders a plain decimal string for form defaults', () => {
    expect(centsToDollars(2900)).toBe('29.00');
    expect(centsToDollars(5)).toBe('0.05');
  });
});

describe('dollarsToCents', () => {
  it('parses whole dollars', () => expect(dollarsToCents('29')).toBe(2900));
  it('parses one decimal place', () => expect(dollarsToCents('29.5')).toBe(2950));
  it('parses two decimal places', () => expect(dollarsToCents('29.99')).toBe(2999));
  it('trims whitespace', () => expect(dollarsToCents(' 10.00 ')).toBe(1000));
  it('rejects negatives', () => expect(dollarsToCents('-5')).toBeNull());
  it('rejects three decimals', () => expect(dollarsToCents('1.999')).toBeNull());
  it('rejects non-numbers', () => expect(dollarsToCents('abc')).toBeNull());
  it('rejects empty', () => expect(dollarsToCents('')).toBeNull());
});
```

`src/lib/slugify.test.ts`:
```ts
import { slugify } from './slugify';

const API_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Organic Cotton Tee')).toBe('organic-cotton-tee');
  });
  it('collapses punctuation and spaces', () => {
    expect(slugify("Kids' Tee — 2-Pack!")).toBe('kids-tee-2-pack');
  });
  it('strips leading/trailing separators', () => {
    expect(slugify('  --Hello--  ')).toBe('hello');
  });
  it('always matches the API slug pattern for non-empty results', () => {
    for (const input of ['A B', 'Über Cool', '99 Problems', 'x']) {
      const slug = slugify(input);
      if (slug) expect(slug).toMatch(API_SLUG_PATTERN);
    }
  });
});
```

`src/lib/order-actions.test.ts`:
```ts
import { availableOrderActions } from './order-actions';

describe('availableOrderActions', () => {
  it('PAID → can ship and refund', () => {
    expect(availableOrderActions('PAID')).toEqual({
      nextStatus: 'SHIPPED',
      canRefund: true,
    });
  });
  it('SHIPPED → can deliver and refund', () => {
    expect(availableOrderActions('SHIPPED')).toEqual({
      nextStatus: 'DELIVERED',
      canRefund: true,
    });
  });
  it('DELIVERED → refund only', () => {
    expect(availableOrderActions('DELIVERED')).toEqual({
      nextStatus: null,
      canRefund: true,
    });
  });
  it.each(['PENDING', 'CANCELLED', 'REFUNDED'] as const)(
    '%s → no actions',
    (status) => {
      expect(availableOrderActions(status)).toEqual({
        nextStatus: null,
        canRefund: false,
      });
    },
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/lib/money.ts`:
```ts
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ''] = trimmed.split('.');
  return Number(dollars) * 100 + Number(fraction.padEnd(2, '0') || '0');
}
```

`src/lib/slugify.ts`:
```ts
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

`src/lib/order-actions.ts`:
```ts
export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface OrderActions {
  nextStatus: 'SHIPPED' | 'DELIVERED' | null;
  canRefund: boolean;
}

export function availableOrderActions(status: OrderStatus): OrderActions {
  const nextStatus =
    status === 'PAID' ? 'SHIPPED' : status === 'SHIPPED' ? 'DELIVERED' : null;
  const canRefund =
    status === 'PAID' || status === 'SHIPPED' || status === 'DELIVERED';
  return { nextStatus, canRefund };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (3 files).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: money, slugify, order-action utilities"
```

---

### Task 9: Firebase auth — provider, login, admin gate

**Files:**
- Create: `src/auth/firebase.ts`, `src/auth/AuthProvider.tsx`, `src/auth/RequireAdmin.tsx`
- Create: `src/auth/AuthProvider.test.tsx`
- Create: `src/pages/login.tsx`

**Interfaces:**
- Consumes: shadcn `Button`, `Card`, `Input`, `Label`; `sonner` toast.
- Produces:
  - `src/auth/firebase.ts`: `auth` (Firebase Auth instance), `storage` (Firebase Storage instance) — emulator-connected when `VITE_USE_EMULATORS === 'true'`.
  - `useAuth(): { user: User | null; isAdmin: boolean; loading: boolean; signOutUser: () => Promise<void> }`
  - `<AuthProvider>` context wrapper; `<RequireAdmin>` route gate (redirects to `/login` when signed out, renders a "Not authorized" screen when signed in without the claim).
  - `<LoginPage>` at `/login` (email/password, redirects to `/` on success).

- [ ] **Step 1: Firebase initialization**

Create `src/auth/firebase.ts`:
```ts
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
});

export const auth = getAuth(app);
export const storage = getStorage(app);

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
```

- [ ] **Step 2: Write the failing AuthProvider test**

Create `src/auth/AuthProvider.test.tsx`. Mock `./firebase` and `firebase/auth` so no network is touched:
```tsx
import { act, render, screen } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { vi } from 'vitest';

const onAuthStateChangedMock = vi.fn();
vi.mock('./firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  signOut: vi.fn(),
}));

import { AuthProvider, useAuth } from './AuthProvider';

function Probe() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return (
    <div>
      {user ? `user:${user.uid}` : 'signed-out'} admin:{String(isAdmin)}
    </div>
  );
}

function fakeUser(claims: Record<string, unknown>): User {
  return {
    uid: 'u1',
    getIdTokenResult: vi.fn().mockResolvedValue({ claims }),
  } as unknown as User;
}

describe('AuthProvider', () => {
  it('exposes loading, then admin user state', async () => {
    let fire: (u: User | null) => void = () => {};
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      fire = cb;
      return () => {};
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText('loading')).toBeInTheDocument();

    await act(async () => fire(fakeUser({ admin: true })));
    expect(await screen.findByText('user:u1 admin:true')).toBeInTheDocument();
  });

  it('reports non-admin for missing claim', async () => {
    let fire: (u: User | null) => void = () => {};
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      fire = cb;
      return () => {};
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => fire(fakeUser({})));
    expect(await screen.findByText('user:u1 admin:false')).toBeInTheDocument();
  });

  it('reports signed-out', async () => {
    let fire: (u: User | null) => void = () => {};
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      fire = cb;
      return () => {};
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => fire(null));
    expect(await screen.findByText(/signed-out/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- AuthProvider`
Expected: FAIL — `./AuthProvider` not found.

- [ ] **Step 4: Implement AuthProvider**

Create `src/auth/AuthProvider.tsx`:
```tsx
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { auth } from './firebase';

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthContextValue, 'signOutUser'>>({
    user: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState({ user: null, isAdmin: false, loading: false });
        return;
      }
      // Force refresh so a freshly granted admin claim is visible after re-login.
      void user.getIdTokenResult(true).then((token) => {
        setState({ user, isAdmin: token.claims.admin === true, loading: false });
      });
    });
  }, []);

  const signOutUser = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ ...state, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
```

Note: the test's fake user resolves `getIdTokenResult` regardless of the force-refresh flag, so this passes both tests.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- AuthProvider`
Expected: PASS (3 tests).

- [ ] **Step 6: RequireAdmin gate and Login page**

Create `src/auth/RequireAdmin.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthProvider';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signOutUser } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="text-muted-foreground">
          {user.email} does not have admin access.
        </p>
        <Button variant="outline" onClick={() => void signOutUser()}>
          Sign out
        </Button>
      </div>
    );
  }
  return children;
}
```

Create `src/pages/login.tsx`:
```tsx
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/auth/AuthProvider';
import { auth } from '@/auth/firebase';

export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/', { replace: true });
    } catch {
      toast.error('Sign-in failed. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admin sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Verify emulator round-trip manually**

```bash
# terminal 1 (ecommerce-admin):
npm run emulators
# terminal 2 (ecommerce-api):
npm run seed:emulator
```
Expected: "Emulator admin ready: admin@example.com / password123". (Full login UX is verified in Task 10 once routes exist.)

- [ ] **Step 8: Run full test suite, commit**

Run: `npm test && npm run build`
Expected: PASS, clean build.

```bash
git add -A && git commit -m "feat: firebase auth provider, admin gate, login page"
```

---

### Task 10: Generated API client, query hooks foundation, app shell & routes

**Files:**
- Create: `openapi-ts.config.ts`, `src/api/generated/**` (generated, committed)
- Create: `src/api/client.ts`, `src/api/unwrap.ts`, `src/api/unwrap.test.ts`
- Create: `src/components/ErrorBoundary.tsx`, `src/components/layout/AppShell.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `openapi.json` at `../ecommerce-api/openapi.json` (Task 5); `auth` (Task 9).
- Produces:
  - Generated SDK functions in `src/api/generated/sdk.gen.ts` named from Nest operationIds: `productsControllerFindAll`, `productsControllerFindByIdAdmin`, `productsControllerCreate`, `productsControllerUpdate`, `productsControllerDeactivate`, `categoriesControllerFindAll`, `categoriesControllerCreate`, `categoriesControllerUpdate`, `categoriesControllerRemove`, `ordersControllerFindAll`, `ordersControllerFindOne`, `ordersControllerUpdateStatus`, `ordersControllerRefund`, `adminControllerStats`. Types in `types.gen.ts`: `ProductResponseDto`, `PaginatedProductsDto`, `CategoryResponseDto`, `OrderResponseDto`, `PaginatedOrdersDto`, `AdminStatsDto`, `CreateProductDto`, `UpdateProductDto`, `CreateCategoryDto`, `UpdateCategoryDto`. **After generating, read `sdk.gen.ts` and reconcile any naming drift before writing hooks.**
  - `src/api/client.ts`: side-effect module configuring `baseUrl`, bearer-token request interceptor, 401→sign-out response interceptor. Import once in `src/main.tsx`.
  - `unwrap<T>(call): Promise<T>` + `ApiError { status: number; message: string }` — every query/mutation goes through it.
  - `<AppShell>` sidebar layout; routes: `/login`, and gated `/`, `/products`, `/products/new`, `/products/:id`, `/categories`, `/orders`, `/orders/:id` (placeholder `<div>`s for pages built in later tasks — each later task replaces its placeholder).

- [ ] **Step 1: Configure and run generation**

`openapi-ts.config.ts`:
```ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../ecommerce-api/openapi.json',
  output: { path: 'src/api/generated', format: 'prettier' },
  plugins: ['@hey-api/client-fetch'],
});
```

Run: `npm run generate:api`
Expected: `src/api/generated/` contains `client.gen.ts`, `sdk.gen.ts`, `types.gen.ts`, `index.ts`. Open `sdk.gen.ts` and confirm the function names listed in Interfaces (adjust later hook code if your generator version names them differently).

- [ ] **Step 2: Write the failing unwrap test**

`src/api/unwrap.test.ts`:
```ts
import { unwrap, type ApiError } from './unwrap';

function res(status: number): Response {
  return { status } as Response;
}

describe('unwrap', () => {
  it('returns data on success', async () => {
    await expect(
      unwrap(Promise.resolve({ data: { ok: 1 }, response: res(200) })),
    ).resolves.toEqual({ ok: 1 });
  });

  it('throws ApiError with the API message string', async () => {
    const err = unwrap(
      Promise.resolve({
        error: { statusCode: 409, message: 'Insufficient stock' },
        response: res(409),
      }),
    );
    await expect(err).rejects.toMatchObject({
      status: 409,
      message: 'Insufficient stock',
    } satisfies Partial<ApiError>);
  });

  it('joins array messages (class-validator style)', async () => {
    const err = unwrap(
      Promise.resolve({
        error: { statusCode: 400, message: ['name too short', 'slug invalid'] },
        response: res(400),
      }),
    );
    await expect(err).rejects.toMatchObject({
      status: 400,
      message: 'name too short, slug invalid',
    });
  });

  it('falls back to a generic message', async () => {
    const err = unwrap(Promise.resolve({ error: 'boom', response: res(500) }));
    await expect(err).rejects.toMatchObject({
      status: 500,
      message: 'Something went wrong',
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- unwrap`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement unwrap and client config**

`src/api/unwrap.ts`:
```ts
export interface ApiError {
  status: number;
  message: string;
}

interface SdkResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

function messageFrom(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return 'Something went wrong';
}

export async function unwrap<T>(call: Promise<SdkResult<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (error !== undefined) {
    const apiError: ApiError = {
      status: response.status,
      message: messageFrom(error),
    };
    throw apiError;
  }
  return data as T;
}
```

`src/api/client.ts`:
```ts
import { signOut } from 'firebase/auth';
import { auth } from '@/auth/firebase';
import { client } from './generated/client.gen';

client.setConfig({ baseUrl: import.meta.env.VITE_API_URL });

client.interceptors.request.use(async (request) => {
  const user = auth.currentUser;
  if (user) {
    request.headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  return request;
});

client.interceptors.response.use((response) => {
  if (response.status === 401) void signOut(auth);
  return response;
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- unwrap`
Expected: PASS (4 tests).

- [ ] **Step 6: App shell and routing**

Create `src/components/ErrorBoundary.tsx` (last-resort catch around the routed area, per spec):
```tsx
import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 py-20">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Create `src/components/layout/AppShell.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/products', label: 'Products' },
  { to: '/categories', label: 'Categories' },
  { to: '/orders', label: 'Orders' },
];

export function AppShell() {
  const { user, signOutUser } = useAuth();
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r bg-muted/30 p-4">
        <div className="mb-6 text-lg font-semibold">Store Admin</div>
        <nav className="grid gap-1">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm hover:bg-muted',
                  isActive && 'bg-muted font-medium',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 pt-6">
          <div className="truncate text-xs text-muted-foreground">
            {user?.email}
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOutUser()}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
```

Replace `src/App.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/login';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAdmin>
                  <AppShell />
                </RequireAdmin>
              }
            >
              <Route index element={<div>Dashboard (Task 15)</div>} />
              <Route path="products" element={<div>Products (Task 12)</div>} />
              <Route path="products/new" element={<div>New product (Task 13)</div>} />
              <Route path="products/:id" element={<div>Edit product (Task 13)</div>} />
              <Route path="categories" element={<div>Categories (Task 11)</div>} />
              <Route path="orders" element={<div>Orders (Task 14)</div>} />
              <Route path="orders/:id" element={<div>Order detail (Task 14)</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

Update `src/main.tsx` to import the client config side-effect module:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import '@/api/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Verify the login round-trip in the browser**

With emulators running (Task 9 Step 7), API running (`PORT=3002 npm run start:dev` in ecommerce-api), and `npm run dev` here: open `http://localhost:5174`, expect redirect to `/login`; sign in as `admin@example.com` / `password123`; expect the shell with sidebar and placeholders. Sign out; expect return to `/login`.

- [ ] **Step 8: Full tests + build, commit**

Run: `npm test && npm run build`
Expected: PASS, clean.

```bash
git add -A && git commit -m "feat: generated api client, unwrap, app shell and routes"
```

---

### Task 11: Categories page (CRUD + drag reorder)

**Files:**
- Create: `src/api/hooks/categories.ts`
- Create: `src/components/SortableList.tsx`
- Create: `src/pages/categories/index.tsx`, `src/pages/categories/index.test.tsx`
- Modify: `src/App.tsx` (swap placeholder for `<CategoriesPage />`)

**Interfaces:**
- Consumes: `unwrap`, generated SDK (`categoriesController*`), `slugify`, shadcn Table/Input/Button/AlertDialog, dnd-kit.
- Produces:
  - Hooks: `useCategories()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()`, `useReorderCategories()` (query key `['categories']`).
  - `<SortableList items={...} getId={...} onReorder={(reordered) => ...} renderItem={(item, handleProps) => ...} />` — generic vertical dnd-kit list, reused for product images in Task 13.

- [ ] **Step 1: Category hooks**

Create `src/api/hooks/categories.ts`:
```ts
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  categoriesControllerCreate,
  categoriesControllerFindAll,
  categoriesControllerRemove,
  categoriesControllerUpdate,
} from '../generated/sdk.gen';
import type {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../generated/types.gen';
import { unwrap } from '../unwrap';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => unwrap(categoriesControllerFindAll()),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCategoryDto) =>
      unwrap(categoriesControllerCreate({ body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCategoryDto }) =>
      unwrap(categoriesControllerUpdate({ path: { id }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(categoriesControllerRemove({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ordered: CategoryResponseDto[]) =>
      Promise.all(
        ordered.map((cat, index) =>
          cat.sortOrder === index
            ? Promise.resolve(null)
            : unwrap(
                categoriesControllerUpdate({
                  path: { id: cat.id },
                  body: { sortOrder: index },
                }),
              ),
        ),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
```

- [ ] **Step 2: Generic SortableList**

Create `src/components/SortableList.tsx`:
```tsx
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HTMLAttributes, ReactNode } from 'react';

export type DragHandleProps = HTMLAttributes<HTMLElement>;

interface SortableItemProps<T> {
  id: string;
  item: T;
  renderItem: (item: T, handleProps: DragHandleProps) => ReactNode;
}

function SortableItem<T>({ id, item, renderItem }: SortableItemProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {renderItem(item, { ...attributes, ...listeners })}
    </div>
  );
}

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (reordered: T[]) => void;
  renderItem: (item: T, handleProps: DragHandleProps) => ReactNode;
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => getId(i) === active.id);
    const newIndex = items.findIndex((i) => getId(i) === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(getId)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItem
            key={getId(item)}
            id={getId(item)}
            item={item}
            renderItem={renderItem}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 3: Write the failing page test**

Create `src/pages/categories/index.test.tsx` — mock the hooks module, assert rendering + create flow wiring:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createMutate = vi.fn();
vi.mock('@/api/hooks/categories', () => ({
  useCategories: () => ({
    data: [
      { id: 'c1', name: 'Tees', slug: 'tees', sortOrder: 0 },
      { id: 'c2', name: 'Hoodies', slug: 'hoodies', sortOrder: 1 },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateCategory: () => ({ mutate: createMutate, isPending: false }),
  useUpdateCategory: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCategory: () => ({ mutate: vi.fn(), isPending: false }),
  useReorderCategories: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { CategoriesPage } from './index';

describe('CategoriesPage', () => {
  it('lists categories', () => {
    render(<CategoriesPage />);
    expect(screen.getByText('Tees')).toBeInTheDocument();
    expect(screen.getByText('Hoodies')).toBeInTheDocument();
  });

  it('creates a category with an auto-generated slug', async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />);
    await user.type(
      screen.getByPlaceholderText('New category name'),
      'Winter Wear',
    );
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Winter Wear', slug: 'winter-wear' }),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- categories`
Expected: FAIL — `./index` has no `CategoriesPage`.

- [ ] **Step 5: Implement the page**

Create `src/pages/categories/index.tsx`:
```tsx
import { GripVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from '@/api/hooks/categories';
import type { ApiError } from '@/api/unwrap';
import { SortableList } from '@/components/SortableList';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { slugify } from '@/lib/slugify';

function errorToast(e: unknown) {
  toast.error((e as ApiError).message ?? 'Something went wrong');
}

export function CategoriesPage() {
  const { data: categories, isLoading, error } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const reorder = useReorderCategories();
  const [newName, setNewName] = useState('');

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-destructive">Failed to load categories.</div>;

  function onAdd() {
    const name = newName.trim();
    if (!name) return;
    create.mutate(
      { name, slug: slugify(name) },
      {
        onSuccess: () => setNewName(''),
        onError: errorToast,
      },
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Categories</h1>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        />
        <Button onClick={onAdd} disabled={create.isPending}>
          Add
        </Button>
      </div>

      <div className="grid gap-2">
        <SortableList
          items={categories ?? []}
          getId={(c) => c.id}
          onReorder={(ordered) =>
            reorder.mutate(ordered, { onError: errorToast })
          }
          renderItem={(cat, handleProps) => (
            <div className="flex items-center gap-2 rounded-md border bg-background p-2">
              <button
                type="button"
                {...handleProps}
                className="cursor-grab text-muted-foreground"
                aria-label={`Reorder ${cat.name}`}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <Input
                defaultValue={cat.name}
                className="h-8"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== cat.name) {
                    update.mutate(
                      { id: cat.id, body: { name } },
                      { onError: errorToast },
                    );
                  }
                }}
              />
              <span className="w-32 truncate text-xs text-muted-foreground">
                /{cat.slug}
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{cat.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Categories that still contain products cannot be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        remove.mutate(cat.id, { onError: errorToast })
                      }
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        />
      </div>
    </div>
  );
}
```
(`lucide-react` ships with shadcn/ui; if missing run `npm i lucide-react`.)

In `src/App.tsx`, replace the categories placeholder:
```tsx
import { CategoriesPage } from '@/pages/categories';
// ...
<Route path="categories" element={<CategoriesPage />} />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- categories`
Expected: PASS (2 tests).

- [ ] **Step 7: Manual check + commit**

With API + emulators + dev server running and demo data seeded: visit `/categories`, expect Tees/Hoodies; add, rename, drag-reorder, delete an empty one; deleting `hoodies` (has products) shows the API's conflict message as a toast.

```bash
git add -A && git commit -m "feat: categories page with CRUD and drag reorder"
```

---

### Task 12: Products list page

**Files:**
- Create: `src/api/hooks/products.ts`
- Create: `src/pages/products/index.tsx`, `src/pages/products/index.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: generated SDK (`productsController*`), `useCategories` (Task 11), `formatUsd` (Task 8).
- Produces: hooks `useProducts(params: { q?: string; category?: string; page: number; all: boolean })` (query key `['products', params]`), `useProduct(id: string)` (key `['products', id]`), `useCreateProduct()`, `useUpdateProduct()` — the latter two consumed by Task 13.

- [ ] **Step 1: Product hooks**

Create `src/api/hooks/products.ts`:
```ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  productsControllerCreate,
  productsControllerFindAll,
  productsControllerFindByIdAdmin,
  productsControllerUpdate,
} from '../generated/sdk.gen';
import type {
  CreateProductDto,
  UpdateProductDto,
} from '../generated/types.gen';
import { unwrap } from '../unwrap';

export interface ProductListParams {
  q?: string;
  category?: string;
  page: number;
  all: boolean;
}

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () =>
      unwrap(
        productsControllerFindAll({
          query: {
            page: params.page,
            pageSize: 20,
            ...(params.q ? { q: params.q } : {}),
            ...(params.category ? { category: params.category } : {}),
            ...(params.all ? { all: true } : {}),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => unwrap(productsControllerFindByIdAdmin({ path: { id } })),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductDto) =>
      unwrap(productsControllerCreate({ body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProductDto }) =>
      unwrap(productsControllerUpdate({ path: { id }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
```

- [ ] **Step 2: Write the failing page test**

Create `src/pages/products/index.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('@/api/hooks/products', () => ({
  useProducts: () => ({
    data: {
      items: [
        {
          id: 'p1',
          name: 'Organic Cotton Tee',
          slug: 'organic-cotton-tee',
          priceCents: 2900,
          stockQty: 40,
          active: true,
          averageRating: 4.5,
          reviewCount: 2,
          category: { id: 'c1', name: 'Tees' },
        },
        {
          id: 'p2',
          name: 'Retired Crewneck',
          slug: 'retired-crewneck',
          priceCents: 5900,
          stockQty: 0,
          active: false,
          averageRating: null,
          reviewCount: 0,
          category: { id: 'c2', name: 'Hoodies' },
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    },
    isLoading: false,
    error: null,
    isPlaceholderData: false,
  }),
}));
vi.mock('@/api/hooks/categories', () => ({
  useCategories: () => ({ data: [], isLoading: false, error: null }),
}));

import { ProductsPage } from './index';

describe('ProductsPage', () => {
  it('renders products with price, stock, and status', () => {
    render(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Organic Cotton Tee')).toBeInTheDocument();
    expect(screen.getByText('$29.00')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('4.5 (2)')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- products`
Expected: FAIL — no `ProductsPage`.

- [ ] **Step 4: Implement the page**

Create `src/pages/products/index.tsx`:
```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCategories } from '@/api/hooks/categories';
import { useProducts } from '@/api/hooks/products';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatUsd } from '@/lib/money';

const ALL_CATEGORIES = '__all__';

export function ProductsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [showInactive, setShowInactive] = useState(true);
  const [page, setPage] = useState(1);

  const { data: categories } = useCategories();
  const { data, isLoading, error } = useProducts({
    q: q || undefined,
    category: category === ALL_CATEGORIES ? undefined : category,
    page,
    all: showInactive,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Button asChild>
          <Link to="/products/new">New product</Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search products…"
          className="max-w-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={(v) => {
              setShowInactive(v);
              setPage(1);
            }}
          />
          <Label htmlFor="show-inactive">Include inactive</Label>
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {error != null && (
        <div className="text-destructive">Failed to load products.</div>
      )}

      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => void navigate(`/products/${p.id}`)}
                >
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category?.name ?? '—'}</TableCell>
                  <TableCell>{formatUsd(p.priceCents)}</TableCell>
                  <TableCell>{p.stockQty}</TableCell>
                  <TableCell>
                    {p.averageRating === null
                      ? '—'
                      : `${p.averageRating} (${p.reviewCount})`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? 'default' : 'secondary'}>
                      {p.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {data.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

In `src/App.tsx`, replace the products placeholder:
```tsx
import { ProductsPage } from '@/pages/products';
// ...
<Route path="products" element={<ProductsPage />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- products`
Expected: PASS.

- [ ] **Step 6: Manual check + commit**

In the browser: `/products` shows the three demo products (Retired Crewneck visible only with "Include inactive" on), search narrows, category filter works, pagination controls disabled appropriately.

```bash
git add -A && git commit -m "feat: products list with filters and pagination"
```

---

### Task 13: Product create/edit form with image upload

**Files:**
- Create: `src/components/ImageUpload.tsx`
- Create: `src/pages/products/product-form.tsx`, `src/pages/products/product-form.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useProduct`, `useCreateProduct`, `useUpdateProduct` (Task 12), `useCategories` (Task 11), `dollarsToCents`/`centsToDollars` (Task 8), `slugify` (Task 8), `SortableList` (Task 11), `storage` (Task 9), shadcn form components.
- Produces: `<ProductFormPage />` used for both `/products/new` and `/products/:id`; `<ImageUpload value: string[] onChange(next: string[]) />` uploading to Firebase Storage path `products/<uuid>-<filename>`.

- [ ] **Step 1: Write the failing form tests**

Create `src/pages/products/product-form.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

const createMutate = vi.fn();
vi.mock('@/api/hooks/products', () => ({
  useProduct: () => ({ data: undefined, isLoading: false, error: null }),
  useCreateProduct: () => ({ mutate: createMutate, isPending: false }),
  useUpdateProduct: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/api/hooks/categories', () => ({
  useCategories: () => ({
    data: [{ id: 'c1', name: 'Tees', slug: 'tees', sortOrder: 0 }],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('@/components/ImageUpload', () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}));

import { ProductFormPage } from './product-form';

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/products/new']}>
      <Routes>
        <Route path="/products/new" element={<ProductFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductFormPage (create)', () => {
  beforeEach(() => createMutate.mockClear());

  it('auto-generates the slug from the name', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText('Name'), 'Organic Cotton Tee');
    expect(screen.getByLabelText('Slug')).toHaveValue('organic-cotton-tee');
  });

  it('stops auto-generating after the slug is manually edited', async () => {
    const user = userEvent.setup();
    renderNew();
    const slug = screen.getByLabelText('Slug');
    await user.type(slug, 'custom-slug');
    await user.type(screen.getByLabelText('Name'), 'New Name');
    expect(slug).toHaveValue('custom-slug');
  });

  it('submits dollars converted to integer cents', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText('Name'), 'Tee');
    await user.type(screen.getByLabelText('Description'), 'Nice tee');
    await user.type(screen.getByLabelText('Price (USD)'), '29.99');
    await user.type(screen.getByLabelText('Stock'), '10');
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Tees' }));
    await user.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      name: 'Tee',
      slug: 'tee',
      priceCents: 2999,
      stockQty: 10,
      categoryId: 'c1',
      active: true,
    });
  });

  it('rejects an invalid price', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText('Name'), 'Tee');
    await user.type(screen.getByLabelText('Description'), 'Nice tee');
    await user.type(screen.getByLabelText('Price (USD)'), '1.999');
    await user.type(screen.getByLabelText('Stock'), '10');
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Tees' }));
    await user.click(screen.getByRole('button', { name: /create product/i }));

    expect(await screen.findByText(/valid price/i)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- product-form`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ImageUpload**

Create `src/components/ImageUpload.tsx`:
```tsx
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { GripVertical, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { storage } from '@/auth/firebase';
import { SortableList } from '@/components/SortableList';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        Array.from(files).map(async (file) => {
          const storageRef = ref(
            storage,
            `products/${crypto.randomUUID()}-${file.name}`,
          );
          await uploadBytes(storageRef, file);
          return getDownloadURL(storageRef);
        }),
      );
      onChange([...value, ...urls]);
    } catch {
      toast.error('Image upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-2">
        <SortableList
          items={value.map((url, i) => ({ url, key: `${i}-${url}` }))}
          getId={(item) => item.key}
          onReorder={(items) => onChange(items.map((i) => i.url))}
          renderItem={(item, handleProps) => (
            <div className="flex items-center gap-2 rounded-md border p-2">
              <button
                type="button"
                {...handleProps}
                className="cursor-grab text-muted-foreground"
                aria-label="Reorder image"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <img
                src={item.url}
                alt=""
                className="h-12 w-12 rounded object-cover"
              />
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {item.url}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove image"
                onClick={() => onChange(value.filter((u) => u !== item.url))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Upload images
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Implement the form page**

Create `src/pages/products/product-form.tsx`:
```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useCreateProduct,
  useProduct,
  useUpdateProduct,
} from '@/api/hooks/products';
import { useCategories } from '@/api/hooks/categories';
import type { ApiError } from '@/api/unwrap';
import { ImageUpload } from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { centsToDollars, dollarsToCents } from '@/lib/money';
import { slugify } from '@/lib/slugify';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case'),
  description: z.string().min(1, 'Description is required'),
  price: z
    .string()
    .refine((v) => dollarsToCents(v) !== null, 'Enter a valid price'),
  categoryId: z.string().min(1, 'Pick a category'),
  stockQty: z.coerce.number().int().min(0),
  active: z.boolean(),
  images: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = {
  name: '',
  slug: '',
  description: '',
  price: '',
  categoryId: '',
  stockQty: 0,
  active: true,
  images: [],
};

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { data: categories } = useCategories();
  const { data: existing, isLoading } = useProduct(id ?? '');
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (isEdit && existing) {
      form.reset({
        name: existing.name,
        slug: existing.slug,
        description: existing.description,
        price: centsToDollars(existing.priceCents),
        categoryId: existing.categoryId,
        stockQty: existing.stockQty,
        active: existing.active,
        images: existing.images,
      });
    }
  }, [isEdit, existing, form]);

  function onNameChange(name: string) {
    form.setValue('name', name);
    if (!slugTouched) form.setValue('slug', slugify(name));
  }

  function onSubmit(values: FormValues) {
    const body = {
      name: values.name,
      slug: values.slug,
      description: values.description,
      priceCents: dollarsToCents(values.price)!,
      categoryId: values.categoryId,
      stockQty: values.stockQty,
      active: values.active,
      images: values.images,
    };
    const opts = {
      onSuccess: () => {
        toast.success(isEdit ? 'Product updated' : 'Product created');
        void navigate('/products');
      },
      onError: (e: unknown) =>
        toast.error((e as ApiError).message ?? 'Something went wrong'),
    };
    if (isEdit && id) update.mutate({ id, body }, opts);
    else create.mutate(body, opts);
  }

  if (isEdit && isLoading) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">
        {isEdit ? 'Edit product' : 'New product'}
      </h1>
      <Form {...form}>
        <form
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          className="grid gap-5"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => onNameChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => {
                      setSlugTouched(true);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (USD)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="29.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stockQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger aria-label="Category">
                      <SelectValue placeholder="Pick a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="images"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Images</FormLabel>
                <FormControl>
                  <ImageUpload value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormLabel>Active</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={create.isPending || update.isPending}
            >
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigate('/products')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

In `src/App.tsx`, replace the two placeholders:
```tsx
import { ProductFormPage } from '@/pages/products/product-form';
// ...
<Route path="products/new" element={<ProductFormPage />} />
<Route path="products/:id" element={<ProductFormPage />} />
```

Note: `useProduct('')` fires a useless query on the create route; guard it by adding `enabled: id !== ''` to `useProduct` in `src/api/hooks/products.ts`:
```ts
export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => unwrap(productsControllerFindByIdAdmin({ path: { id } })),
    enabled: id !== '',
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- product-form`
Expected: PASS (4 tests).

- [ ] **Step 6: Manual check + commit**

In the browser: create a product with an uploaded image (Storage emulator must be running); verify it appears in `/products` and the image URL starts with `http://127.0.0.1:9199`. Edit it; toggle active off; verify the badge flips.

```bash
git add -A && git commit -m "feat: product create/edit form with image upload"
```

---

### Task 14: Orders list, detail, status transitions, refund

**Files:**
- Create: `src/api/hooks/orders.ts`
- Create: `src/pages/orders/index.tsx`
- Create: `src/pages/orders/order-detail.tsx`, `src/pages/orders/order-detail.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: generated SDK (`ordersController*`), `availableOrderActions` (Task 8), `formatUsd` (Task 8).
- Produces: `useOrders(params: { status?: string; email?: string; page: number })` (key `['orders', params]`), `useOrder(id)` (key `['orders', id]`, accepts `refetchInterval`), `useUpdateOrderStatus()`, `useRefundOrder()`.

- [ ] **Step 1: Order hooks**

Create `src/api/hooks/orders.ts`:
```ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ordersControllerFindAll,
  ordersControllerFindOne,
  ordersControllerRefund,
  ordersControllerUpdateStatus,
} from '../generated/sdk.gen';
import { unwrap } from '../unwrap';

export interface OrderListParams {
  status?: string;
  email?: string;
  page: number;
}

export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () =>
      unwrap(
        ordersControllerFindAll({
          query: {
            page: params.page,
            pageSize: 20,
            ...(params.status ? { status: params.status } : {}),
            ...(params.email ? { email: params.email } : {}),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string, refetchIntervalMs?: number) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => unwrap(ordersControllerFindOne({ path: { id } })),
    refetchInterval: refetchIntervalMs ?? false,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'SHIPPED' | 'DELIVERED';
    }) => unwrap(ordersControllerUpdateStatus({ path: { id }, body: { status } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(ordersControllerRefund({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}
```
(If the generated `status` query param type is the `OrderStatus` enum type rather than `string`, match it — check `types.gen.ts`.)

- [ ] **Step 2: Write the failing order-detail test**

Create `src/pages/orders/order-detail.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

const state: { status: string } = { status: 'PAID' };

vi.mock('@/api/hooks/orders', () => ({
  useOrder: () => ({
    data: {
      id: 'o1',
      email: 'buyer@example.com',
      status: state.status,
      stripeSessionId: 'cs_123',
      stripePaymentIntentId: 'pi_123',
      shippingAddress: { name: 'Demo Buyer', line1: '1 Main St' },
      subtotalCents: 5800,
      totalCents: 5800,
      items: [
        {
          id: 'i1',
          productId: 'p1',
          name: 'Organic Cotton Tee',
          priceCents: 2900,
          quantity: 2,
        },
      ],
      createdAt: '2026-07-09T10:00:00.000Z',
      updatedAt: '2026-07-09T10:00:00.000Z',
    },
    isLoading: false,
    error: null,
  }),
  useUpdateOrderStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useRefundOrder: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { OrderDetailPage } from './order-detail';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/o1']}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderDetailPage', () => {
  it('PAID order offers Mark shipped and Refund', () => {
    state.status = 'PAID';
    renderPage();
    expect(
      screen.getByRole('button', { name: /mark shipped/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refund/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /mark delivered/i }),
    ).not.toBeInTheDocument();
  });

  it('SHIPPED order offers Mark delivered', () => {
    state.status = 'SHIPPED';
    renderPage();
    expect(
      screen.getByRole('button', { name: /mark delivered/i }),
    ).toBeInTheDocument();
  });

  it('REFUNDED order offers no actions', () => {
    state.status = 'REFUNDED';
    renderPage();
    expect(
      screen.queryByRole('button', { name: /mark|refund/i }),
    ).not.toBeInTheDocument();
  });

  it('shows line items and totals', () => {
    state.status = 'PAID';
    renderPage();
    expect(screen.getByText('Organic Cotton Tee')).toBeInTheDocument();
    expect(screen.getByText('× 2')).toBeInTheDocument();
    expect(screen.getAllByText('$58.00').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- order-detail`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement orders list page**

Create `src/pages/orders/index.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useOrders } from '@/api/hooks/orders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatUsd } from '@/lib/money';
import type { OrderStatus } from '@/lib/order-actions';

const ALL_STATUSES = '__all__';
const STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const STATUS_VARIANT: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'outline',
  PAID: 'default',
  SHIPPED: 'default',
  DELIVERED: 'secondary',
  CANCELLED: 'destructive',
  REFUNDED: 'destructive',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(ALL_STATUSES);
  const [email, setEmail] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useOrders({
    status: status === ALL_STATUSES ? undefined : status,
    email: email || undefined,
    page,
  });
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Orders</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search by email…"
          className="max-w-xs"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {error != null && (
        <div className="text-destructive">Failed to load orders.</div>
      )}

      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => void navigate(`/orders/${o.id}`)}
                >
                  <TableCell className="font-mono text-xs">{o.id}</TableCell>
                  <TableCell>
                    {new Date(o.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{o.email}</TableCell>
                  <TableCell>
                    {formatUsd(o.totalCents ?? o.subtotalCents)}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status as OrderStatus} />
                  </TableCell>
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {data.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement order detail page**

Create `src/pages/orders/order-detail.tsx`:
```tsx
import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import {
  useOrder,
  useRefundOrder,
  useUpdateOrderStatus,
} from '@/api/hooks/orders';
import type { ApiError } from '@/api/unwrap';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatUsd } from '@/lib/money';
import {
  availableOrderActions,
  type OrderStatus,
} from '@/lib/order-actions';
import { OrderStatusBadge } from './index';

function errorToast(e: unknown) {
  toast.error((e as ApiError).message ?? 'Something went wrong');
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const [refundRequested, setRefundRequested] = useState(false);

  const { data: order, isLoading, error } = useOrder(
    id,
    refundRequested ? 3000 : undefined,
  );
  const updateStatus = useUpdateOrderStatus();
  const refund = useRefundOrder();

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error != null || !order) {
    return <div className="text-destructive">Failed to load order.</div>;
  }

  const status = order.status as OrderStatus;
  const { nextStatus, canRefund } = availableOrderActions(status);
  const refundPending = refundRequested && status !== 'REFUNDED';
  const address = order.shippingAddress as Record<string, string> | null;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Order {order.id}</h1>
        <OrderStatusBadge status={status} />
        {refundPending && (
          <span className="text-sm text-muted-foreground">refund pending…</span>
        )}
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name}{' '}
                  <span className="text-muted-foreground">
                    × {item.quantity}
                  </span>
                </span>
                <span>{formatUsd(item.priceCents * item.quantity)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm font-medium">
              <span>Total</span>
              <span>{formatUsd(order.totalCents ?? order.subtotalCents)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <div>{order.email}</div>
            {address && (
              <div className="text-muted-foreground">
                {['name', 'line1', 'line2', 'city', 'state', 'postal_code', 'country']
                  .map((k) => address[k])
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <div>Session: {order.stripeSessionId ?? '—'}</div>
            <div>Payment intent: {order.stripePaymentIntentId ?? '—'}</div>
            <div>Created: {new Date(order.createdAt).toLocaleString()}</div>
            <div>Updated: {new Date(order.updatedAt).toLocaleString()}</div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          {nextStatus && (
            <Button
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate(
                  { id: order.id, status: nextStatus },
                  { onError: errorToast },
                )
              }
            >
              {nextStatus === 'SHIPPED' ? 'Mark shipped' : 'Mark delivered'}
            </Button>
          )}
          {canRefund && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={refundPending}>
                  Refund
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Refund {formatUsd(order.totalCents ?? order.subtotalCents)}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This triggers a full refund in Stripe. The order flips to
                    REFUNDED when Stripe confirms via webhook.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      refund.mutate(order.id, {
                        onSuccess: () => setRefundRequested(true),
                        onError: errorToast,
                      })
                    }
                  >
                    Refund
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
```

In `src/App.tsx`, replace the orders placeholders:
```tsx
import { OrdersPage } from '@/pages/orders';
import { OrderDetailPage } from '@/pages/orders/order-detail';
// ...
<Route path="orders" element={<OrdersPage />} />
<Route path="orders/:id" element={<OrderDetailPage />} />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- order-detail`
Expected: PASS (4 tests). Then `npm test` — all suites pass.

- [ ] **Step 7: Manual check + commit**

In the browser: `/orders` shows the two demo orders; filter by status PAID; search `buyer@`; open the PAID order → "Mark shipped" transitions it (badge updates); the SHIPPED order offers "Mark delivered". Refund will fail against the fake Stripe key — expect a clean error toast, not a crash.

```bash
git add -A && git commit -m "feat: orders list, detail, status transitions, refund"
```

---

### Task 15: Dashboard

**Files:**
- Create: `src/api/hooks/stats.ts`
- Create: `src/pages/dashboard/index.tsx`, `src/pages/dashboard/index.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `adminControllerStats` (generated), `AdminStatsDto`.
- Produces: `useAdminStats()` (query key `['admin-stats']`).

- [ ] **Step 1: Write the failing test**

Create `src/pages/dashboard/index.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('@/api/hooks/stats', () => ({
  useAdminStats: () => ({
    data: {
      ordersToday: 7,
      lowStockProducts: [
        { id: 'p2', name: 'Heavyweight Hoodie', slug: 'heavyweight-hoodie', stockQty: 3 },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

import { DashboardPage } from './index';

describe('DashboardPage', () => {
  it('shows orders today and low-stock products with links', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('7')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /heavyweight hoodie/i });
    expect(link).toHaveAttribute('href', '/products/p2');
    expect(screen.getByText(/3 left/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dashboard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/api/hooks/stats.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { adminControllerStats } from '../generated/sdk.gen';
import { unwrap } from '../unwrap';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => unwrap(adminControllerStats()),
    refetchOnWindowFocus: true,
  });
}
```

Create `src/pages/dashboard/index.tsx`:
```tsx
import { Link } from 'react-router';
import { useAdminStats } from '@/api/hooks/stats';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function DashboardPage() {
  const { data, isLoading, error } = useAdminStats();

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error != null || !data) {
    return <div className="text-destructive">Failed to load stats.</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">{data.ordersToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Low stock ({data.lowStockProducts.length})</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {data.lowStockProducts.length === 0 && (
              <div className="text-sm text-muted-foreground">
                All products sufficiently stocked.
              </div>
            )}
            {data.lowStockProducts.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="flex justify-between text-sm hover:underline"
              >
                <span>{p.name}</span>
                <span className="text-muted-foreground">{p.stockQty} left</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

In `src/App.tsx`, replace the index placeholder:
```tsx
import { DashboardPage } from '@/pages/dashboard';
// ...
<Route index element={<DashboardPage />} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Manual check + commit**

Browser: `/` shows orders-today count (2 from seed — both demo orders are PAID/SHIPPED and created today) and Heavyweight Hoodie (3 left) linking to its edit page.

```bash
git add -A && git commit -m "feat: dashboard with orders-today and low-stock cards"
```

---

### Task 16: README, full manual QA, wrap-up

**Files:**
- Create: `ecommerce-admin/README.md`
- Modify (if QA finds issues): whatever the fixes touch

**Interfaces:**
- Produces: documented one-command-per-terminal dev loop; a QA-verified admin portal.

- [ ] **Step 1: Write the README**

Create `README.md` in `ecommerce-admin`:
```markdown
# ecommerce-admin

Admin portal for the ecommerce platform. React 19 + Vite + TypeScript,
Tailwind v4 + shadcn/ui, TanStack Query over a generated OpenAPI client,
Firebase Auth (admin custom claim required).

## Dev loop (four terminals)

    # 1. Postgres (in ecommerce-api)
    docker compose up -d db

    # 2. Firebase emulators (here) — Auth :9099, Storage :9199, UI :4000
    npm run emulators

    # 3. API (in ecommerce-api) — 3001 is taken on this machine
    PORT=3002 npm run start:dev

    # 4. Admin SPA (here) — http://localhost:5174
    npm run dev

One-time setup after the emulators are up (both in ecommerce-api):

    npm run seed:emulator   # admin@example.com / password123
    npm run seed:demo       # demo catalog + orders

## Regenerating the API client

    # in ecommerce-api: refresh openapi.json
    npm run openapi:emit
    # here: regenerate src/api/generated
    npm run generate:api

## Tests

    npm test

## Production notes (Phase 2 does not deploy)

- Set real `VITE_FIREBASE_*` values and `VITE_USE_EMULATORS=false`.
- `storage.rules` is wide open for authed users — lock down before deploying.
- Grant the admin claim with ecommerce-api's `npm run grant-admin -- <email>`.
```

- [ ] **Step 2: Full test suites both repos**

Run in `ecommerce-api`: `npm run build && npm test && npm run test:e2e`
Run in `ecommerce-admin`: `npm run build && npm test`
Expected: everything green. Fix anything that isn't before proceeding.

- [ ] **Step 3: Manual QA checklist**

With the full dev loop running (README steps), verify each — fix and commit anything broken:

1. Signed-out visit to `http://localhost:5174` → redirected to `/login`.
2. Wrong password → error toast, no crash.
3. Login as `admin@example.com` → dashboard.
4. Create a non-admin emulator user via the emulator UI (`http://localhost:4000`) → login shows "Not authorized" + working sign-out.
5. Dashboard: orders-today count matches seeded orders; low-stock lists Heavyweight Hoodie.
6. Categories: add "Accessories"; rename it; drag it to the top (persists after reload); delete it; deleting "Hoodies" fails with a clear toast.
7. Products: search "tee"; filter by category; toggle include-inactive shows Retired Crewneck.
8. Create product "QA Special" at $12.34, stock 2, with an uploaded image → appears in list; price displays $12.34; dashboard low-stock now includes it.
9. Edit QA Special: change price to $15.00, deactivate → badge flips to Inactive.
10. Orders: filter status=PAID; email search "buyer@"; open PAID order → Mark shipped → badge SHIPPED; then Mark delivered → DELIVERED.
11. Refund on the DELIVERED order → confirm dialog shows the dollar amount → expect a clean error toast (fake Stripe key) and "refund pending" NOT stuck permanently (it only appears after a successful refund call).
12. 401 handling: restart the API with `FIREBASE_AUTH_EMULATOR_HOST` unset (tokens now fail verification) → any admin action signs you out to `/login`. Restore the env var after.

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "docs: README and QA fixes"
```

Then update the meta repo's `memory_about_project.md` (Phase 2 complete, how to run) and commit there — and flag Phase 3 (storefront) as next.
