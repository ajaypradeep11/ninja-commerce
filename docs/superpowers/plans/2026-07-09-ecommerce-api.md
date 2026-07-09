# Ecommerce API (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the NestJS backend that owns all data and all Stripe interaction for the ecommerce platform: products, categories, orders, reviews, Firebase-authenticated users, hosted Stripe Checkout, and hardened webhooks with atomic stock decrements.

**Architecture:** Backend-centric — both frontends (built in later phases) are pure API clients. NestJS + Prisma + Postgres. Firebase Auth ID tokens verified on every request via a global guard; admin routes additionally require an `admin` custom claim. Stripe hosted Checkout; webhooks are idempotent (dedup by event ID inside the same DB transaction as the side effects) and stock decrements are guarded so overselling cannot happen.

**Tech Stack:** NestJS 11, Prisma 6, Postgres 16 (Docker locally, Neon in prod), firebase-admin 13, stripe SDK (latest), class-validator, @nestjs/swagger, Jest.

**Spec:** `/Users/ajaypradeepm/Work/Ecommerce/docs/superpowers/specs/2026-07-09-ecommerce-platform-design.md`

## Global Constraints

- Project root: `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-api` — its own git repository (NOT the meta repo).
- All prices are **integer cents** (`priceCents`, `subtotalCents`, `totalCents`). Never floats.
- Single-SKU products — no variants anywhere.
- Order status enum: `PENDING → PAID → SHIPPED → DELIVERED`, terminal branches `CANCELLED`, `REFUNDED`.
- All write endpoints for catalog/orders are admin-only (`admin: true` Firebase custom claim). Product/category/review reads are public.
- The backend never talks to Firebase for anything except token verification and the one-off claim-granting script. No passwords stored.
- TypeScript strict mode. TDD: every task writes the failing test first. Commit at the end of every task.
- Currency: `usd`.
- Unit tests mock `PrismaService`, `FirebaseService`, and `StripeService` — they must not need the DB or network. Only the final e2e task touches the real (local Docker) database.

---

### Task 1: Scaffold project, config, health endpoint

**Files:**
- Create: entire NestJS scaffold at `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-api` (via CLI)
- Create: `docker-compose.yml`, `.env`, `.env.example`
- Modify: `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`

**Interfaces:**
- Produces: running app on port 3001, `GET /health` → `{"status":"ok"}`, global `ConfigService` with validated env vars (`DATABASE_URL`, `PORT`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS`, `FIREBASE_PROJECT_ID`), global `ValidationPipe`, `rawBody` enabled (needed by Task 8 webhooks).

- [ ] **Step 1: Scaffold and install dependencies**

```bash
cd /Users/ajaypradeepm/Work/Ecommerce
npx @nestjs/cli@11 new ecommerce-api --package-manager npm --strict
cd ecommerce-api
npm i @nestjs/config joi class-validator class-transformer @nestjs/swagger stripe firebase-admin @prisma/client
npm i -D prisma
```

Note: `nest new` initializes a git repo in `ecommerce-api/` — that is the repo we commit to for all tasks in this plan.

- [ ] **Step 2: Create `docker-compose.yml` and env files**

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ecommerce
      POSTGRES_PASSWORD: ecommerce
      POSTGRES_DB: ecommerce
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

`.env` (and `.env.example` with the same keys, secrets blanked):
```
DATABASE_URL=postgresql://ecommerce:ecommerce@localhost:5432/ecommerce
PORT=3001
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
FIREBASE_PROJECT_ID=replace-with-firebase-project-id
```

Append `.env` to `.gitignore`.

- [ ] **Step 3: Write the failing test (health endpoint)**

Replace `src/app.controller.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('GET /health returns ok', async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    const controller = module.get(AppController);
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- app.controller`
Expected: FAIL — `controller.health is not a function`

- [ ] **Step 5: Implement config, health, bootstrap**

`src/app.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health(): { status: string } {
    return this.appService.health();
  }
}
```

`src/app.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health(): { status: string } {
    return { status: 'ok' };
  }
}
```

`src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().default(3001),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        FRONTEND_URL: Joi.string().uri().required(),
        CORS_ORIGINS: Joi.string().required(),
        FIREBASE_PROJECT_ID: Joi.string().required(),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

`src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: config.getOrThrow<string>('CORS_ORIGINS').split(',') });
  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- app.controller`
Expected: PASS

- [ ] **Step 7: Verify the app boots**

```bash
docker compose up -d db
npm run start &
sleep 5 && curl -s http://localhost:3001/health
kill %1
```
Expected: `{"status":"ok"}`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold NestJS app with validated config, health endpoint, local Postgres"
```

---

### Task 2: Prisma schema and PrismaService

**Files:**
- Create: `prisma/schema.prisma`, `src/prisma/prisma.service.ts`, `src/prisma/prisma.module.ts`
- Modify: `src/app.module.ts` (import PrismaModule), `package.json` (prisma generate on postinstall)

**Interfaces:**
- Produces: global `PrismaService extends PrismaClient` injectable everywhere; Prisma models `Category`, `Product`, `User`, `Order`, `OrderItem`, `Review`, `ProcessedStripeEvent`; enums `Role { CUSTOMER, ADMIN }`, `OrderStatus { PENDING, PAID, SHIPPED, DELIVERED, CANCELLED, REFUNDED }`. All later tasks consume these exact model/field names.

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  CUSTOMER
  ADMIN
}

enum OrderStatus {
  PENDING
  PAID
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

model Category {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  sortOrder Int       @default(0)
  products  Product[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Product {
  id          String      @id @default(cuid())
  name        String
  slug        String      @unique
  description String
  priceCents  Int
  images      String[]
  stockQty    Int         @default(0)
  active      Boolean     @default(true)
  category    Category    @relation(fields: [categoryId], references: [id])
  categoryId  String
  reviews     Review[]
  orderItems  OrderItem[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([categoryId])
}

model User {
  id        String   @id // Firebase UID
  email     String   @unique
  role      Role     @default(CUSTOMER)
  addresses Json     @default("[]")
  orders    Order[]
  reviews   Review[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Order {
  id                    String      @id @default(cuid())
  user                  User        @relation(fields: [userId], references: [id])
  userId                String
  email                 String
  status                OrderStatus @default(PENDING)
  stripeSessionId       String?     @unique
  stripePaymentIntentId String?     @unique
  shippingAddress       Json?
  subtotalCents         Int
  totalCents            Int?
  items                 OrderItem[]
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  @@index([userId])
  @@index([status])
}

model OrderItem {
  id         String  @id @default(cuid())
  order      Order   @relation(fields: [orderId], references: [id])
  orderId    String
  product    Product @relation(fields: [productId], references: [id])
  productId  String
  name       String // snapshot at purchase time
  priceCents Int // snapshot at purchase time
  quantity   Int
}

model Review {
  id        String   @id @default(cuid())
  product   Product  @relation(fields: [productId], references: [id])
  productId String
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  rating    Int
  text      String
  createdAt DateTime @default(now())

  @@unique([productId, userId])
}

model ProcessedStripeEvent {
  id        String   @id // Stripe event id
  type      String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run the migration**

```bash
docker compose up -d db
npx prisma migrate dev --name init
```
Expected: `Your database is now in sync with your schema` and generated client output.

- [ ] **Step 3: Create PrismaService and global PrismaModule**

`src/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
```

`src/prisma/prisma.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

In `src/app.module.ts`, add `PrismaModule` to the `imports` array (keep everything else):
```typescript
import { PrismaModule } from './prisma/prisma.module';
// ...
  imports: [
    ConfigModule.forRoot({ /* unchanged */ }),
    PrismaModule,
  ],
```

- [ ] **Step 4: Verify boot with DB connection**

```bash
npm run start &
sleep 5 && curl -s http://localhost:3001/health
kill %1
```
Expected: `{"status":"ok"}` with no Prisma connection errors in the log.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema (catalog, orders, reviews, users, webhook dedup) and global PrismaService"
```

---

### Task 3: Firebase auth — global guard, admin guard, decorators

**Files:**
- Create: `src/firebase/firebase.module.ts`, `src/firebase/firebase.service.ts`
- Create: `src/auth/auth.module.ts`, `src/auth/auth.types.ts`, `src/auth/firebase-auth.guard.ts`, `src/auth/admin.guard.ts`, `src/auth/public.decorator.ts`, `src/auth/current-user.decorator.ts`
- Test: `src/auth/firebase-auth.guard.spec.ts`, `src/auth/admin.guard.spec.ts`
- Modify: `src/app.module.ts` (import FirebaseModule, AuthModule)

**Interfaces:**
- Consumes: `ConfigService` (`FIREBASE_PROJECT_ID`).
- Produces:
  - `interface AuthUser { uid: string; email: string; admin: boolean }` (in `auth.types.ts`)
  - `FirebaseService.verifyIdToken(token: string): Promise<DecodedIdToken>`
  - Global `FirebaseAuthGuard` (registered as `APP_GUARD`): rejects requests without a valid `Authorization: Bearer <idToken>` header, attaches `req.user: AuthUser`. Custom claim `admin: true` maps to `user.admin`.
  - `@Public()` route/class decorator — skips the auth guard.
  - `AdminGuard` for `@UseGuards(AdminGuard)` — throws 403 unless `req.user.admin`.
  - `@CurrentUser()` param decorator returning `AuthUser`.
  - Mark `GET /health` `@Public()`.

- [ ] **Step 1: Write the failing tests**

`src/auth/firebase-auth.guard.spec.ts`:
```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseService } from '../firebase/firebase.service';

function ctxWith(headers: Record<string, string>): ExecutionContext {
  const req: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  let firebase: { verifyIdToken: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    firebase = { verifyIdToken: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    guard = new FirebaseAuthGuard(
      firebase as unknown as FirebaseService,
      reflector as unknown as Reflector,
    );
  });

  it('allows @Public() routes without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(ctxWith({}))).resolves.toBe(true);
  });

  it('rejects missing bearer token', async () => {
    await expect(guard.canActivate(ctxWith({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid token', async () => {
    firebase.verifyIdToken.mockRejectedValue(new Error('bad'));
    await expect(
      guard.canActivate(ctxWith({ authorization: 'Bearer nope' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches AuthUser with admin claim', async () => {
    firebase.verifyIdToken.mockResolvedValue({
      uid: 'u1',
      email: 'a@b.com',
      admin: true,
    });
    const ctx = ctxWith({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest<{ user: unknown }>();
    expect(req.user).toEqual({ uid: 'u1', email: 'a@b.com', admin: true });
  });
});
```

`src/auth/admin.guard.spec.ts`:
```typescript
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function ctxWithUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('rejects non-admin users', () => {
    expect(() =>
      guard.canActivate(ctxWithUser({ uid: 'u1', email: 'a@b.com', admin: false })),
    ).toThrow(ForbiddenException);
  });

  it('allows admins', () => {
    expect(
      guard.canActivate(ctxWithUser({ uid: 'u1', email: 'a@b.com', admin: true })),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- auth`
Expected: FAIL — cannot find modules `./firebase-auth.guard`, `./admin.guard`.

- [ ] **Step 3: Implement**

`src/firebase/firebase.service.ts`:
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app!: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // Token verification only needs the project id (public Google certs).
    // GOOGLE_APPLICATION_CREDENTIALS is only required for the grant-admin script.
    this.app =
      admin.apps.length > 0
        ? admin.app()
        : admin.initializeApp({
            projectId: this.config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
          });
  }

  verifyIdToken(token: string): Promise<DecodedIdToken> {
    return this.app.auth().verifyIdToken(token);
  }
}
```

`src/firebase/firebase.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
```

`src/auth/auth.types.ts`:
```typescript
export interface AuthUser {
  uid: string;
  email: string;
  admin: boolean;
}
```

`src/auth/public.decorator.ts`:
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`src/auth/firebase-auth.guard.ts`:
```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from '../firebase/firebase.service';
import { AuthUser } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: AuthUser }>();
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const decoded = await this.firebase.verifyIdToken(header.slice(7));
      req.user = {
        uid: decoded.uid,
        email: decoded.email ?? '',
        admin: decoded.admin === true,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

`src/auth/admin.guard.ts`:
```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from './auth.types';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (req.user?.admin !== true) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
```

`src/auth/current-user.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const req = context.switchToHttp().getRequest<{ user: AuthUser }>();
    return req.user;
  },
);
```

`src/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Module({
  providers: [{ provide: APP_GUARD, useClass: FirebaseAuthGuard }],
})
export class AuthModule {}
```

In `src/app.module.ts`, add `FirebaseModule` and `AuthModule` to imports:
```typescript
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
// imports: [ConfigModule..., PrismaModule, FirebaseModule, AuthModule],
```

In `src/app.controller.ts`, mark health public:
```typescript
import { Public } from './auth/public.decorator';
// ...
  @Public()
  @Get('health')
  health(): { status: string } {
    return this.appService.health();
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- auth`
Expected: PASS (6 tests). Also run `npm test` — the app.controller test still passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Firebase auth with global guard, admin guard, Public/CurrentUser decorators"
```

---

### Task 4: Users module — ensureUser, profile, saved addresses

**Files:**
- Create: `src/users/users.module.ts`, `src/users/users.service.ts`, `src/users/users.controller.ts`, `src/users/dto/update-addresses.dto.ts`
- Test: `src/users/users.service.spec.ts`
- Modify: `src/app.module.ts` (import UsersModule)

**Interfaces:**
- Consumes: `PrismaService`, `AuthUser`, `@CurrentUser()`.
- Produces:
  - `UsersService.ensureUser(uid: string, email: string): Promise<User>` — upsert; later tasks (checkout, reviews) call this before creating dependent rows.
  - `UsersService.getMe(uid: string, email: string): Promise<User>`
  - `UsersService.updateAddresses(uid: string, email: string, addresses: AddressDto[]): Promise<User>`
  - Endpoints: `GET /me`, `PUT /me/addresses` (both authenticated, non-admin).
  - `AddressDto { label?, line1, line2?, city, state?, postalCode, country }`

- [ ] **Step 1: Write the failing test**

`src/users/users.service.spec.ts`:
```typescript
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let prisma: { user: { upsert: jest.Mock; update: jest.Mock } };
  let service: UsersService;

  beforeEach(() => {
    prisma = { user: { upsert: jest.fn(), update: jest.fn() } };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('ensureUser upserts by uid and keeps email current', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    await service.ensureUser('u1', 'a@b.com');
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 'u1' },
      create: { id: 'u1', email: 'a@b.com' },
      update: { email: 'a@b.com' },
    });
  });

  it('updateAddresses ensures the user exists then stores addresses', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', addresses: [] });
    const addresses = [
      { line1: '1 Main St', city: 'Berlin', postalCode: '10115', country: 'DE' },
    ];
    await service.updateAddresses('u1', 'a@b.com', addresses);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { addresses },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- users`
Expected: FAIL — cannot find module `./users.service`.

- [ ] **Step 3: Implement**

`src/users/dto/update-addresses.dto.ts`:
```typescript
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class AddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  postalCode!: string;

  @IsString()
  @Length(2, 2)
  country!: string;
}

export class UpdateAddressesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses!: AddressDto[];
}
```

`src/users/users.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddressDto } from './dto/update-addresses.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  ensureUser(uid: string, email: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { id: uid },
      create: { id: uid, email },
      update: { email },
    });
  }

  getMe(uid: string, email: string): Promise<User> {
    return this.ensureUser(uid, email);
  }

  async updateAddresses(
    uid: string,
    email: string,
    addresses: AddressDto[],
  ): Promise<User> {
    await this.ensureUser(uid, email);
    return this.prisma.user.update({
      where: { id: uid },
      data: { addresses: addresses as unknown as object[] },
    });
  }
}
```

`src/users/users.controller.ts`:
```typescript
import { Body, Controller, Get, Put } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { UpdateAddressesDto } from './dto/update-addresses.dto';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser): Promise<User> {
    return this.users.getMe(user.uid, user.email);
  }

  @Put('addresses')
  updateAddresses(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAddressesDto,
  ): Promise<User> {
    return this.users.updateAddresses(user.uid, user.email, dto.addresses);
  }
}
```

`src/users/users.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

Add `UsersModule` to `src/app.module.ts` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- users`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: users module with ensureUser upsert, profile, and saved addresses"
```

---

### Task 5: Categories module

**Files:**
- Create: `src/categories/categories.module.ts`, `src/categories/categories.service.ts`, `src/categories/categories.controller.ts`, `src/categories/dto/create-category.dto.ts`, `src/categories/dto/update-category.dto.ts`
- Test: `src/categories/categories.service.spec.ts`
- Modify: `src/app.module.ts` (import CategoriesModule)

**Interfaces:**
- Consumes: `PrismaService`, `AdminGuard`, `@Public()`.
- Produces:
  - `CategoriesService.findAll(): Promise<Category[]>` (ordered by `sortOrder`)
  - `CategoriesService.create(dto)`, `.update(id, dto)`, `.remove(id)` — remove throws `ConflictException` if products reference it (Prisma error `P2003`), `NotFoundException` on unknown id (`P2025`).
  - Endpoints: `GET /categories` (public); `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id` (admin).
  - `CreateCategoryDto { name: string; slug: string; sortOrder?: number }`; `UpdateCategoryDto` = partial of create.

- [ ] **Step 1: Write the failing test**

`src/categories/categories.service.spec.ts`:
```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('err', {
    code,
    clientVersion: 'test',
  });
}

describe('CategoriesService', () => {
  let prisma: {
    category: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: CategoriesService;

  beforeEach(() => {
    prisma = {
      category: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  it('findAll orders by sortOrder', async () => {
    prisma.category.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('create passes dto through', async () => {
    prisma.category.create.mockResolvedValue({ id: 'c1' });
    await service.create({ name: 'Tees', slug: 'tees' });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Tees', slug: 'tees' },
    });
  });

  it('create maps duplicate slug (P2002) to ConflictException', async () => {
    prisma.category.create.mockRejectedValue(prismaError('P2002'));
    await expect(service.create({ name: 'T', slug: 'tees' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('remove maps FK violation (P2003) to ConflictException', async () => {
    prisma.category.delete.mockRejectedValue(prismaError('P2003'));
    await expect(service.remove('c1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('remove maps missing row (P2025) to NotFoundException', async () => {
    prisma.category.delete.mockRejectedValue(prismaError('P2025'));
    await expect(service.remove('c1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- categories`
Expected: FAIL — cannot find module `./categories.service`.

- [ ] **Step 3: Implement**

`src/categories/dto/create-category.dto.ts`:
```typescript
import { IsInt, IsOptional, IsString, Matches } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  slug!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
```

`src/categories/dto/update-category.dto.ts`:
```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
```

`src/categories/categories.service.ts`:
```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

function mapPrismaError(e: unknown, entity: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw new ConflictException(`${entity} with this slug already exists`);
    }
    if (e.code === 'P2003') {
      throw new ConflictException(`${entity} is still referenced by other records`);
    }
    if (e.code === 'P2025') {
      throw new NotFoundException(`${entity} not found`);
    }
  }
  throw e;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    try {
      return await this.prisma.category.create({ data: { ...dto } });
    } catch (e) {
      mapPrismaError(e, 'Category');
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    try {
      return await this.prisma.category.update({ where: { id }, data: { ...dto } });
    } catch (e) {
      mapPrismaError(e, 'Category');
    }
  }

  async remove(id: string): Promise<Category> {
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (e) {
      mapPrismaError(e, 'Category');
    }
  }
}
```

`src/categories/categories.controller.ts`:
```typescript
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
import { Category } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { Public } from '../auth/public.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  findAll(): Promise<Category[]> {
    return this.categories.findAll();
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categories.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categories.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<Category> {
    return this.categories.remove(id);
  }
}
```

`src/categories/categories.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
```

Add `CategoriesModule` to `src/app.module.ts` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- categories`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: categories CRUD with admin-guarded writes and Prisma error mapping"
```

---

### Task 6: Products module — CRUD, search/filter/pagination, stock adjustment, ratings

**Files:**
- Create: `src/products/products.module.ts`, `src/products/products.service.ts`, `src/products/products.controller.ts`, `src/products/dto/create-product.dto.ts`, `src/products/dto/update-product.dto.ts`, `src/products/dto/list-products.query.ts`, `src/products/dto/adjust-stock.dto.ts`
- Test: `src/products/products.service.spec.ts`
- Modify: `src/app.module.ts` (import ProductsModule)

**Interfaces:**
- Consumes: `PrismaService`, `AdminGuard`, `@Public()`, `mapPrismaError` pattern from Task 5 (re-implemented locally — do not import across modules).
- Produces:
  - `ProductsService.findAll(query: ListProductsQuery, includeInactive?: boolean): Promise<{ items: ProductWithRating[]; total: number; page: number; pageSize: number }>`
  - `ProductsService.findBySlug(slug: string): Promise<ProductWithRating>` — 404 if missing or inactive.
  - `ProductsService.create(dto)`, `.update(id, dto)`, `.deactivate(id)` (sets `active: false`, never hard-deletes), `.adjustStock(id, delta)` — guarded so stock can never go negative; throws `ConflictException('Insufficient stock')`.
  - `ProductWithRating` = Prisma `Product` + `{ category: Category; averageRating: number | null; reviewCount: number }`.
  - Endpoints: `GET /products`, `GET /products/:slug` (public, active only); `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` (deactivate), `PATCH /products/:id/stock` (all admin). Admin listing: `GET /products?all=true` requires the caller to be admin (403 otherwise).
  - `ListProductsQuery { category?: string (slug); q?: string; page?: number=1; pageSize?: number=12 (max 48); sort?: 'newest'|'price_asc'|'price_desc'; all?: boolean }`
  - `AdjustStockDto { delta: number (int, != 0) }`

- [ ] **Step 1: Write the failing test**

`src/products/products.service.spec.ts`:
```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  let prisma: {
    product: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    review: { groupBy: jest.Mock };
  };
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      review: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  it('findAll filters to active products with category slug and search text', async () => {
    await service.findAll({ category: 'tees', q: 'polka', page: 2, pageSize: 12, sort: 'price_asc' });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        category: { slug: 'tees' },
        OR: [
          { name: { contains: 'polka', mode: 'insensitive' } },
          { description: { contains: 'polka', mode: 'insensitive' } },
        ],
      },
      include: { category: true },
      orderBy: { priceCents: 'asc' },
      skip: 12,
      take: 12,
    });
  });

  it('findAll includes inactive products when includeInactive', async () => {
    await service.findAll({ page: 1, pageSize: 12 }, true);
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where.active).toBeUndefined();
  });

  it('findAll merges review aggregates into items', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    prisma.product.count.mockResolvedValue(2);
    prisma.review.groupBy.mockResolvedValue([
      { productId: 'p1', _avg: { rating: 4.5 }, _count: { rating: 2 } },
    ]);
    const result = await service.findAll({ page: 1, pageSize: 12 });
    expect(result.items[0]).toMatchObject({ id: 'p1', averageRating: 4.5, reviewCount: 2 });
    expect(result.items[1]).toMatchObject({ id: 'p2', averageRating: null, reviewCount: 0 });
    expect(result.total).toBe(2);
  });

  it('findBySlug throws 404 for inactive product', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', active: false });
    await expect(service.findBySlug('gone')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adjustStock guards against going negative', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.adjustStock('p1', -5)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', stockQty: { gte: 5 } },
      data: { stockQty: { increment: -5 } },
    });
  });

  it('adjustStock increments without guard for positive delta', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', stockQty: 15 });
    await service.adjustStock('p1', 10);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stockQty: { increment: 10 } },
    });
  });

  it('deactivate sets active false', async () => {
    prisma.product.update.mockResolvedValue({ id: 'p1', active: false });
    await service.deactivate('p1');
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { active: false },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- products`
Expected: FAIL — cannot find module `./products.service`.

- [ ] **Step 3: Implement**

`src/products/dto/create-product.dto.ts`:
```typescript
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  slug!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsArray()
  @IsUrl({}, { each: true })
  images!: string[];

  @IsInt()
  @Min(0)
  stockQty!: number;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
```

`src/products/dto/update-product.dto.ts`:
```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

`src/products/dto/list-products.query.ts`:
```typescript
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListProductsQuery {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize: number = 12;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: 'newest' | 'price_asc' | 'price_desc';

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  all?: boolean;
}
```

`src/products/dto/adjust-stock.dto.ts`:
```typescript
import { IsInt, NotEquals } from 'class-validator';

export class AdjustStockDto {
  @IsInt()
  @NotEquals(0)
  delta!: number;
}
```

`src/products/products.service.ts`:
```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQuery } from './dto/list-products.query';
import { UpdateProductDto } from './dto/update-product.dto';

export type ProductWithRating = Product & {
  category?: Category;
  averageRating: number | null;
  reviewCount: number;
};

export interface PaginatedProducts {
  items: ProductWithRating[];
  total: number;
  page: number;
  pageSize: number;
}

const SORT_MAP: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  price_asc: { priceCents: 'asc' },
  price_desc: { priceCents: 'desc' },
};

function mapPrismaError(e: unknown, entity: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw new ConflictException(`${entity} with this slug already exists`);
    }
    if (e.code === 'P2025' || e.code === 'P2003') {
      throw new NotFoundException(`${entity} or its category not found`);
    }
  }
  throw e;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async withRatings<T extends Product>(
    products: T[],
  ): Promise<(T & { averageRating: number | null; reviewCount: number })[]> {
    if (products.length === 0) return [];
    const aggregates = await this.prisma.review.groupBy({
      by: ['productId'],
      where: { productId: { in: products.map((p) => p.id) } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const byId = new Map(aggregates.map((a) => [a.productId, a]));
    return products.map((p) => ({
      ...p,
      averageRating: byId.get(p.id)?._avg.rating ?? null,
      reviewCount: byId.get(p.id)?._count.rating ?? 0,
    }));
  }

  async findAll(
    query: ListProductsQuery,
    includeInactive = false,
  ): Promise<PaginatedProducts> {
    const { category, q, page = 1, pageSize = 12, sort } = query;
    const where: Prisma.ProductWhereInput = {
      ...(includeInactive ? {} : { active: true }),
      ...(category ? { category: { slug: category } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: SORT_MAP[sort ?? 'newest'],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items: await this.withRatings(products), total, page, pageSize };
  }

  async findBySlug(slug: string): Promise<ProductWithRating> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: true },
    });
    if (!product || !product.active) {
      throw new NotFoundException('Product not found');
    }
    const [withRating] = await this.withRatings([product]);
    return withRating;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    try {
      return await this.prisma.product.create({ data: { ...dto } });
    } catch (e) {
      mapPrismaError(e, 'Product');
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    try {
      return await this.prisma.product.update({ where: { id }, data: { ...dto } });
    } catch (e) {
      mapPrismaError(e, 'Product');
    }
  }

  async deactivate(id: string): Promise<Product> {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { active: false },
      });
    } catch (e) {
      mapPrismaError(e, 'Product');
    }
  }

  async adjustStock(id: string, delta: number): Promise<Product> {
    const where: Prisma.ProductWhereInput & { id: string } =
      delta < 0 ? { id, stockQty: { gte: -delta } } : { id };
    const result = await this.prisma.product.updateMany({
      where,
      data: { stockQty: { increment: delta } },
    });
    if (result.count === 0) {
      throw new ConflictException('Insufficient stock');
    }
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
```

`src/products/products.controller.ts`:
```typescript
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
```

Caveat on `@Public()` + `all=true`: the global guard skips token verification on public routes, so `req.user` is unset there — `all=true` would therefore always 403. Fix: on public routes, verify the token opportunistically when an `Authorization` header is present, but never fail. Replace the entire `canActivate` method in `src/auth/firebase-auth.guard.ts` with:
```typescript
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: AuthUser }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (isPublic) {
      if (token) {
        try {
          const decoded = await this.firebase.verifyIdToken(token);
          req.user = {
            uid: decoded.uid,
            email: decoded.email ?? '',
            admin: decoded.admin === true,
          };
        } catch {
          // public route: ignore bad tokens
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const decoded = await this.firebase.verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email ?? '',
        admin: decoded.admin === true,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
```
Add this test to `src/auth/firebase-auth.guard.spec.ts`:
```typescript
  it('attaches user on @Public() routes when a valid token is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    firebase.verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com', admin: true });
    const ctx = ctxWith({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest<{ user: unknown }>();
    expect(req.user).toEqual({ uid: 'u1', email: 'a@b.com', admin: true });
  });
```

`src/products/products.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

Add `ProductsModule` to `src/app.module.ts` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- products auth`
Expected: PASS (products 7 tests, auth guard now 7 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: products with search/filter/pagination, guarded stock adjustment, review aggregates"
```

---

### Task 7: Stripe module + checkout

**Files:**
- Create: `src/stripe/stripe.module.ts`, `src/stripe/stripe.service.ts`
- Create: `src/checkout/checkout.module.ts`, `src/checkout/checkout.service.ts`, `src/checkout/checkout.controller.ts`, `src/checkout/dto/create-checkout.dto.ts`
- Test: `src/checkout/checkout.service.spec.ts`
- Modify: `src/app.module.ts` (import StripeModule, CheckoutModule)

**Interfaces:**
- Consumes: `PrismaService`, `UsersService.ensureUser`, `ConfigService` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`), `@CurrentUser()`.
- Produces:
  - `StripeService.client: Stripe` (raw SDK client) and `StripeService.constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event` (used by Task 8).
  - `CheckoutService.createSession(user: AuthUser, dto: CreateCheckoutDto): Promise<{ url: string; orderId: string }>`
  - Endpoint: `POST /checkout` (authenticated) → `{ url, orderId }`.
  - `CreateCheckoutDto { items: { productId: string; quantity: number (1–99) }[] }` (min 1 item)
  - Orders are created `PENDING` with line-item snapshots; Stripe session carries `metadata.orderId`; `allow_promotion_codes: true`.

- [ ] **Step 1: Write the failing test**

`src/checkout/checkout.service.spec.ts`:
```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

const user = { uid: 'u1', email: 'a@b.com', admin: false };

describe('CheckoutService', () => {
  let prisma: {
    product: { findMany: jest.Mock };
    order: { create: jest.Mock; update: jest.Mock };
  };
  let stripe: { client: { checkout: { sessions: { create: jest.Mock } } } };
  let users: { ensureUser: jest.Mock };
  let service: CheckoutService;

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn() },
      order: {
        create: jest.fn().mockResolvedValue({ id: 'o1' }),
        update: jest.fn().mockResolvedValue({ id: 'o1' }),
      },
    };
    stripe = { client: { checkout: { sessions: { create: jest.fn() } } } };
    users = { ensureUser: jest.fn().mockResolvedValue({ id: 'u1' }) };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
    };
    service = new CheckoutService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
      users as unknown as UsersService,
      config as unknown as ConfigService,
    );
  });

  const tee = { id: 'p1', name: 'Tee', priceCents: 2500, stockQty: 10, active: true };

  it('rejects unknown or inactive products', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await expect(
      service.createSession(user, { items: [{ productId: 'p1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects insufficient stock with a friendly message', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...tee, stockQty: 2 }]);
    await expect(
      service.createSession(user, { items: [{ productId: 'p1', quantity: 3 }] }),
    ).rejects.toThrow('Only 2 left of Tee');
  });

  it('creates a pending order with snapshots and returns the session url', async () => {
    prisma.product.findMany.mockResolvedValue([tee]);
    stripe.client.checkout.sessions.create.mockResolvedValue({
      id: 'cs_1',
      url: 'https://stripe.test/session',
    });
    const result = await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 2 }],
    });
    expect(users.ensureUser).toHaveBeenCalledWith('u1', 'a@b.com');
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        email: 'a@b.com',
        subtotalCents: 5000,
        items: {
          create: [{ productId: 'p1', name: 'Tee', priceCents: 2500, quantity: 2 }],
        },
      },
    });
    const sessionArgs = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(sessionArgs.mode).toBe('payment');
    expect(sessionArgs.allow_promotion_codes).toBe(true);
    expect(sessionArgs.metadata).toEqual({ orderId: 'o1' });
    expect(sessionArgs.line_items).toEqual([
      {
        quantity: 2,
        price_data: {
          currency: 'usd',
          unit_amount: 2500,
          product_data: { name: 'Tee' },
        },
      },
    ]);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { stripeSessionId: 'cs_1' },
    });
    expect(result).toEqual({ url: 'https://stripe.test/session', orderId: 'o1' });
  });

  it('cancels the order if Stripe session creation fails', async () => {
    prisma.product.findMany.mockResolvedValue([tee]);
    stripe.client.checkout.sessions.create.mockRejectedValue(new Error('stripe down'));
    await expect(
      service.createSession(user, { items: [{ productId: 'p1', quantity: 1 }] }),
    ).rejects.toThrow('stripe down');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('rejects duplicate product ids in one cart', async () => {
    await expect(
      service.createSession(user, {
        items: [
          { productId: 'p1', quantity: 1 },
          { productId: 'p1', quantity: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- checkout`
Expected: FAIL — cannot find module `./checkout.service`.

- [ ] **Step 3: Implement**

`src/stripe/stripe.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  readonly client: Stripe;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.client = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'));
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.client.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }
}
```

`src/stripe/stripe.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Global()
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
```

`src/checkout/dto/create-checkout.dto.ts`:
```typescript
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CheckoutItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class CreateCheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];
}
```

`src/checkout/checkout.service.ts`:
```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

const SHIPPING_COUNTRIES = [
  'US', 'GB', 'DE', 'FR', 'NL', 'ES', 'IT', 'IE', 'AT', 'BE',
] as const;

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async createSession(
    user: AuthUser,
    dto: CreateCheckoutDto,
  ): Promise<{ url: string; orderId: string }> {
    const ids = dto.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new ConflictException('Duplicate products in cart — merge quantities');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, active: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines = dto.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} is not available`);
      }
      if (product.stockQty < item.quantity) {
        throw new ConflictException(`Only ${product.stockQty} left of ${product.name}`);
      }
      return { product, quantity: item.quantity };
    });

    await this.users.ensureUser(user.uid, user.email);

    const subtotalCents = lines.reduce(
      (sum, l) => sum + l.product.priceCents * l.quantity,
      0,
    );
    const order = await this.prisma.order.create({
      data: {
        userId: user.uid,
        email: user.email,
        subtotalCents,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            name: l.product.name,
            priceCents: l.product.priceCents,
            quantity: l.quantity,
          })),
        },
      },
    });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    try {
      const session = await this.stripe.client.checkout.sessions.create({
        mode: 'payment',
        customer_email: user.email,
        allow_promotion_codes: true,
        shipping_address_collection: {
          allowed_countries: [...SHIPPING_COUNTRIES],
        },
        line_items: lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: 'usd',
            unit_amount: l.product.priceCents,
            product_data: { name: l.product.name },
          },
        })),
        metadata: { orderId: order.id },
        success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/cart`,
      });
      await this.prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });
      if (!session.url) throw new Error('Stripe session has no url');
      return { url: session.url, orderId: order.id };
    } catch (e) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });
      throw e;
    }
  }
}
```

`src/checkout/checkout.controller.ts`:
```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCheckoutDto,
  ): Promise<{ url: string; orderId: string }> {
    return this.checkout.createSession(user, dto);
  }
}
```

`src/checkout/checkout.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [UsersModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
```

Add `StripeModule` and `CheckoutModule` to `src/app.module.ts` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- checkout`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Stripe hosted checkout — pending order with snapshots, promo codes, cancel on failure"
```

---

### Task 8: Stripe webhooks — idempotent, atomic stock decrement

**Files:**
- Create: `src/webhooks/webhooks.module.ts`, `src/webhooks/webhooks.controller.ts`, `src/webhooks/webhooks.service.ts`
- Test: `src/webhooks/webhooks.service.spec.ts`
- Modify: `src/app.module.ts` (import WebhooksModule)

**Interfaces:**
- Consumes: `StripeService.constructWebhookEvent`, `PrismaService`, `@Public()`, `req.rawBody` (enabled in Task 1).
- Produces:
  - `POST /webhooks/stripe` (public; verified by Stripe signature instead of Firebase auth).
  - `WebhooksService.handleEvent(event: Stripe.Event): Promise<void>` handling:
    - `checkout.session.completed` → order `PAID`, stock decremented atomically, payment intent + shipping address + total stored
    - `checkout.session.expired` → `PENDING` order → `CANCELLED`
    - `charge.refunded` → order → `REFUNDED`, stock restored
  - Idempotency: `ProcessedStripeEvent` row created **inside the same transaction** as the side effects; duplicate event ID (P2002) → no-op.
  - Failures are logged with event ID and rethrown → 500 → Stripe retries.

- [ ] **Step 1: Write the failing test**

`src/webhooks/webhooks.service.spec.ts`:
```typescript
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';

type Tx = {
  processedStripeEvent: { create: jest.Mock };
  order: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock; findFirst: jest.Mock };
  product: { updateMany: jest.Mock };
};

function makeTx(): Tx {
  return {
    processedStripeEvent: { create: jest.fn() },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

function completedEvent(): Stripe.Event {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        metadata: { orderId: 'o1' },
        payment_intent: 'pi_1',
        amount_total: 5000,
        customer_details: { address: { country: 'US' }, name: 'A B' },
      },
    },
  } as unknown as Stripe.Event;
}

describe('WebhooksService', () => {
  let tx: Tx;
  let prisma: { $transaction: jest.Mock };
  let service: WebhooksService;

  beforeEach(() => {
    tx = makeTx();
    prisma = {
      $transaction: jest.fn((cb: (t: Tx) => Promise<void>) => cb(tx)),
    };
    service = new WebhooksService(prisma as unknown as PrismaService);
  });

  it('skips duplicate events (P2002 on processed-event insert)', async () => {
    tx.processedStripeEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.$transaction.mockImplementation(async (cb: (t: Tx) => Promise<void>) => {
      await cb(tx); // create throws inside, service must swallow P2002
    });
    await expect(service.handleEvent(completedEvent())).resolves.toBeUndefined();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('marks order paid and decrements stock atomically', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PENDING',
      subtotalCents: 5000,
      items: [{ productId: 'p1', quantity: 2 }],
    });
    await service.handleEvent(completedEvent());
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', stockQty: { gte: 2 } },
      data: { stockQty: { decrement: 2 } },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: expect.objectContaining({
        status: 'PAID',
        stripePaymentIntentId: 'pi_1',
        totalCents: 5000,
      }),
    });
  });

  it('does not double-process an already-paid order', async () => {
    tx.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PAID', items: [] });
    await service.handleEvent(completedEvent());
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('logs stock shortfall but still marks paid', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PENDING',
      subtotalCents: 5000,
      items: [{ productId: 'p1', quantity: 2 }],
    });
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    await service.handleEvent(completedEvent());
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
    );
  });

  it('cancels pending order on session expiry', async () => {
    const event = {
      id: 'evt_2',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_1', metadata: { orderId: 'o1' } } },
    } as unknown as Stripe.Event;
    await service.handleEvent(event);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  });

  it('refund restores stock and marks order refunded', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'o1',
      status: 'PAID',
      items: [{ productId: 'p1', quantity: 2 }],
    });
    const event = {
      id: 'evt_3',
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_1' } },
    } as unknown as Stripe.Event;
    await service.handleEvent(event);
    expect(tx.order.findFirst).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_1' },
      include: { items: true },
    });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stockQty: { increment: 2 } },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'REFUNDED' },
    });
  });

  it('ignores unhandled event types without touching the db', async () => {
    const event = {
      id: 'evt_4',
      type: 'payment_intent.created',
      data: { object: {} },
    } as unknown as Stripe.Event;
    await service.handleEvent(event);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- webhooks`
Expected: FAIL — cannot find module `./webhooks.service`.

- [ ] **Step 3: Implement**

`src/webhooks/webhooks.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        return this.runOnce(event, (tx) =>
          this.onSessionCompleted(tx, event.data.object),
        );
      case 'checkout.session.expired':
        return this.runOnce(event, (tx) =>
          this.onSessionExpired(tx, event.data.object),
        );
      case 'charge.refunded':
        return this.runOnce(event, (tx) =>
          this.onChargeRefunded(tx, event.data.object),
        );
      default:
        return; // not our concern
    }
  }

  /** Runs fn exactly once per Stripe event id — dedup row and side effects share one transaction. */
  private async runOnce(
    event: Stripe.Event,
    fn: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedStripeEvent.create({
          data: { id: event.id, type: event.type },
        });
        await fn(tx);
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        this.logger.log(`Skipping duplicate event ${event.id}`);
        return;
      }
      this.logger.error(
        `Failed processing event ${event.id} (${event.type}) — Stripe will retry`,
        e instanceof Error ? e.stack : String(e),
      );
      throw e;
    }
  }

  private async onSessionCompleted(
    tx: Prisma.TransactionClient,
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      this.logger.warn(`Session ${session.id} has no orderId metadata`);
      return;
    }
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status !== 'PENDING') return;

    for (const item of order.items) {
      const result = await tx.product.updateMany({
        where: { id: item.productId, stockQty: { gte: item.quantity } },
        data: { stockQty: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        this.logger.error(
          `Stock shortfall: product ${item.productId} on order ${order.id} — paid but not decremented, manual action required`,
        );
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        stripePaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        totalCents: session.amount_total ?? order.subtotalCents,
        shippingAddress: (session.customer_details ?? {}) as object,
      },
    });
  }

  private async onSessionExpired(
    tx: Prisma.TransactionClient,
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;
    await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  private async onChargeRefunded(
    tx: Prisma.TransactionClient,
    charge: Stripe.Charge,
  ): Promise<void> {
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!paymentIntentId) return;

    const order = await tx.order.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { items: true },
    });
    if (!order || order.status === 'REFUNDED') return;

    for (const item of order.items) {
      await tx.product.updateMany({
        where: { id: item.productId },
        data: { stockQty: { increment: item.quantity } },
      });
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'REFUNDED' },
    });
  }
}
```

`src/webhooks/webhooks.controller.ts`:
```typescript
import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { Public } from '../auth/public.decorator';
import { StripeService } from '../stripe/stripe.service';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly stripe: StripeService,
    private readonly webhooks: WebhooksService,
  ) {}

  @Public()
  @Post('stripe')
  async handleStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing signature or body');
    }
    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid signature');
    }
    await this.webhooks.handleEvent(event);
    return { received: true };
  }
}
```

`src/webhooks/webhooks.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
```

Add `WebhooksModule` to `src/app.module.ts` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- webhooks`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: idempotent Stripe webhooks — paid + atomic stock decrement, expiry, refunds"
```

---

### Task 9: Orders module — customer history, admin management, refunds

**Files:**
- Create: `src/orders/orders.module.ts`, `src/orders/orders.service.ts`, `src/orders/orders.controller.ts`, `src/orders/dto/update-order-status.dto.ts`, `src/orders/dto/list-orders.query.ts`
- Test: `src/orders/orders.service.spec.ts`
- Modify: `src/app.module.ts` (import OrdersModule)

**Interfaces:**
- Consumes: `PrismaService`, `StripeService.client.refunds.create`, `AdminGuard`, `@CurrentUser()`, `AuthUser`.
- Produces:
  - `OrdersService.findForUser(uid: string)` — user's orders, newest first, with items.
  - `OrdersService.findAll(query: ListOrdersQuery)` — admin list `{ items, total, page, pageSize }`.
  - `OrdersService.findOne(id: string, requester: AuthUser)` — owner or admin; 403 otherwise; 404 unknown.
  - `OrdersService.updateStatus(id: string, status: 'SHIPPED' | 'DELIVERED')` — only `PAID→SHIPPED`, `SHIPPED→DELIVERED`; `ConflictException` otherwise.
  - `OrdersService.refund(id: string)` — requires status `PAID | SHIPPED | DELIVERED` and a payment intent; calls Stripe; status flips via webhook (Task 8).
  - Endpoints: `GET /orders/me` (auth), `GET /orders` (admin), `GET /orders/:id` (owner/admin), `PATCH /orders/:id/status` (admin), `POST /orders/:id/refund` (admin).
  - `UpdateOrderStatusDto { status: 'SHIPPED' | 'DELIVERED' }`; `ListOrdersQuery { status?: OrderStatus; page?: number=1; pageSize?: number=20 (max 100) }`

- [ ] **Step 1: Write the failing test**

`src/orders/orders.service.spec.ts`:
```typescript
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';

describe('OrdersService', () => {
  let prisma: {
    order: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let stripe: { client: { refunds: { create: jest.Mock } } };
  let service: OrdersService;

  beforeEach(() => {
    prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    stripe = { client: { refunds: { create: jest.fn() } } };
    service = new OrdersService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
    );
  });

  it('findForUser returns own orders newest first with items', async () => {
    await service.findForUser('u1');
    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findOne forbids other customers', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'owner' });
    await expect(
      service.findOne('o1', { uid: 'intruder', email: '', admin: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findOne allows admin', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'owner' });
    await expect(
      service.findOne('o1', { uid: 'other', email: '', admin: true }),
    ).resolves.toMatchObject({ id: 'o1' });
  });

  it('findOne 404s on unknown order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(
      service.findOne('nope', { uid: 'u', email: '', admin: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateStatus allows PAID -> SHIPPED', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PAID' });
    prisma.order.update.mockResolvedValue({ id: 'o1', status: 'SHIPPED' });
    await service.updateStatus('o1', 'SHIPPED');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'SHIPPED' },
    });
  });

  it('updateStatus rejects invalid transition PENDING -> SHIPPED', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PENDING' });
    await expect(service.updateStatus('o1', 'SHIPPED')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refund calls Stripe with the payment intent', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PAID',
      stripePaymentIntentId: 'pi_1',
    });
    stripe.client.refunds.create.mockResolvedValue({ id: 're_1' });
    const result = await service.refund('o1');
    expect(stripe.client.refunds.create).toHaveBeenCalledWith({
      payment_intent: 'pi_1',
    });
    expect(result).toEqual({ refundId: 're_1' });
  });

  it('refund rejects orders that are not paid yet', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PENDING',
      stripePaymentIntentId: null,
    });
    await expect(service.refund('o1')).rejects.toBeInstanceOf(ConflictException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orders`
Expected: FAIL — cannot find module `./orders.service`.

- [ ] **Step 3: Implement**

`src/orders/dto/update-order-status.dto.ts`:
```typescript
import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['SHIPPED', 'DELIVERED'])
  status!: 'SHIPPED' | 'DELIVERED';
}
```

`src/orders/dto/list-orders.query.ts`:
```typescript
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class ListOrdersQuery {
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
```

`src/orders/orders.service.ts`:
```typescript
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Order, OrderItem, OrderStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { ListOrdersQuery } from './dto/list-orders.query';

type OrderWithItems = Order & { items: OrderItem[] };

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  PAID: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
};

const REFUNDABLE: OrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED'];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  findForUser(uid: string): Promise<OrderWithItems[]> {
    return this.prisma.order.findMany({
      where: { userId: uid },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(query: ListOrdersQuery): Promise<{
    items: OrderWithItems[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { status, page = 1, pageSize = 20 } = query;
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string, requester: AuthUser): Promise<OrderWithItems> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!requester.admin && order.userId !== requester.uid) {
      throw new ForbiddenException('Not your order');
    }
    return order;
  }

  async updateStatus(
    id: string,
    status: 'SHIPPED' | 'DELIVERED',
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!VALID_TRANSITIONS[order.status]?.includes(status)) {
      throw new ConflictException(
        `Cannot transition ${order.status} -> ${status}`,
      );
    }
    return this.prisma.order.update({ where: { id }, data: { status } });
  }

  async refund(id: string): Promise<{ refundId: string }> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!REFUNDABLE.includes(order.status) || !order.stripePaymentIntentId) {
      throw new ConflictException('Order is not refundable');
    }
    const refund = await this.stripe.client.refunds.create({
      payment_intent: order.stripePaymentIntentId,
    });
    // Status flips to REFUNDED via the charge.refunded webhook.
    return { refundId: refund.id };
  }
}
```

`src/orders/orders.controller.ts`:
```typescript
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
import { Order } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { ListOrdersQuery } from './dto/list-orders.query';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.orders.findForUser(user.uid);
  }

  @UseGuards(AdminGuard)
  @Get()
  findAll(@Query() query: ListOrdersQuery) {
    return this.orders.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(id, user);
  }

  @UseGuards(AdminGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    return this.orders.updateStatus(id, dto.status);
  }

  @UseGuards(AdminGuard)
  @Post(':id/refund')
  refund(@Param('id') id: string): Promise<{ refundId: string }> {
    return this.orders.refund(id);
  }
}
```

`src/orders/orders.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
```

Add `OrdersModule` to `src/app.module.ts` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- orders`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: orders — customer history, admin list/status transitions, Stripe refunds"
```

---

### Task 10: Reviews module — purchase-gated, one per user per product

**Files:**
- Create: `src/reviews/reviews.module.ts`, `src/reviews/reviews.service.ts`, `src/reviews/reviews.controller.ts`, `src/reviews/dto/create-review.dto.ts`
- Test: `src/reviews/reviews.service.spec.ts`
- Modify: `src/app.module.ts` (import ReviewsModule)

**Interfaces:**
- Consumes: `PrismaService`, `UsersService.ensureUser`, `@Public()`, `@CurrentUser()`.
- Produces:
  - `ReviewsService.listForProduct(productId: string): Promise<{ items: Review[]; averageRating: number | null; count: number }>`
  - `ReviewsService.create(user: AuthUser, productId: string, dto: CreateReviewDto): Promise<Review>` — 403 unless the user has an order containing the product in status `PAID | SHIPPED | DELIVERED`; 409 on duplicate review.
  - Endpoints: `GET /products/:productId/reviews` (public), `POST /products/:productId/reviews` (auth).
  - `CreateReviewDto { rating: int 1–5; text: string (max 2000) }`

- [ ] **Step 1: Write the failing test**

`src/reviews/reviews.service.spec.ts`:
```typescript
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const user = { uid: 'u1', email: 'a@b.com', admin: false };

describe('ReviewsService', () => {
  let prisma: {
    review: { findMany: jest.Mock; aggregate: jest.Mock; create: jest.Mock };
    orderItem: { findFirst: jest.Mock };
  };
  let users: { ensureUser: jest.Mock };
  let service: ReviewsService;

  beforeEach(() => {
    prisma = {
      review: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({
          _avg: { rating: null },
          _count: { rating: 0 },
        }),
        create: jest.fn(),
      },
      orderItem: { findFirst: jest.fn() },
    };
    users = { ensureUser: jest.fn().mockResolvedValue({ id: 'u1' }) };
    service = new ReviewsService(
      prisma as unknown as PrismaService,
      users as unknown as UsersService,
    );
  });

  it('rejects reviews from users who have not purchased the product', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(null);
    await expect(
      service.create(user, 'p1', { rating: 5, text: 'great' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.orderItem.findFirst).toHaveBeenCalledWith({
      where: {
        productId: 'p1',
        order: { userId: 'u1', status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } },
      },
    });
  });

  it('creates a review for a verified purchaser', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi1' });
    prisma.review.create.mockResolvedValue({ id: 'r1' });
    await service.create(user, 'p1', { rating: 4, text: 'nice' });
    expect(prisma.review.create).toHaveBeenCalledWith({
      data: { productId: 'p1', userId: 'u1', rating: 4, text: 'nice' },
    });
  });

  it('maps duplicate review (P2002) to ConflictException', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi1' });
    prisma.review.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create(user, 'p1', { rating: 4, text: 'again' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('listForProduct returns items with aggregate', async () => {
    prisma.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    });
    const result = await service.listForProduct('p1');
    expect(result).toMatchObject({ averageRating: 4.5, count: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reviews`
Expected: FAIL — cannot find module `./reviews.service`.

- [ ] **Step 3: Implement**

`src/reviews/dto/create-review.dto.ts`:
```typescript
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MaxLength(2000)
  text!: string;
}
```

`src/reviews/reviews.service.ts`:
```typescript
import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, Review } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async listForProduct(productId: string): Promise<{
    items: Review[];
    averageRating: number | null;
    count: number;
  }> {
    const [items, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);
    return {
      items,
      averageRating: aggregate._avg.rating,
      count: aggregate._count.rating,
    };
  }

  async create(
    user: AuthUser,
    productId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const purchased = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId: user.uid,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        },
      },
    });
    if (!purchased) {
      throw new ForbiddenException(
        'You can only review products you have purchased',
      );
    }
    await this.users.ensureUser(user.uid, user.email);
    try {
      return await this.prisma.review.create({
        data: { productId, userId: user.uid, rating: dto.rating, text: dto.text },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('You have already reviewed this product');
      }
      throw e;
    }
  }
}
```

`src/reviews/reviews.controller.ts`:
```typescript
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Review } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get()
  list(@Param('productId') productId: string) {
    return this.reviews.listForProduct(productId);
  }

  @Post()
  create(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.reviews.create(user, productId, dto);
  }
}
```

`src/reviews/reviews.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [UsersModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
```

Add `ReviewsModule` to `src/app.module.ts` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- reviews`
Expected: PASS (4 tests). Then run the whole suite: `npm test` — everything passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: purchase-gated product reviews with one-per-user constraint"
```

---

### Task 11: OpenAPI docs, grant-admin script, README

**Files:**
- Modify: `src/main.ts` (Swagger setup)
- Create: `scripts/grant-admin.ts`
- Create/Modify: `README.md`
- Modify: `package.json` (add `grant-admin` script)

**Interfaces:**
- Consumes: everything built so far.
- Produces: Swagger UI at `/docs`, OpenAPI JSON at `/docs-json` (phase 2/3 frontends generate their API clients from this); `npm run grant-admin -- <email>` sets the `admin: true` custom claim.

- [ ] **Step 1: Add Swagger to `src/main.ts`**

Full updated file:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: config.getOrThrow<string>('CORS_ORIGINS').split(',') });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ecommerce API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
```

- [ ] **Step 2: Create `scripts/grant-admin.ts`**

```typescript
/**
 * Grants the `admin: true` custom claim to a Firebase user by email.
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON.
 *
 * Usage: npm run grant-admin -- admin@example.com
 */
import * as admin from 'firebase-admin';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run grant-admin -- <email>');
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`Granted admin claim to ${email} (uid ${user.uid}).`);
  console.log('The user must sign out and back in to refresh their token.');
}

void main();
```

Add to `package.json` scripts:
```json
"grant-admin": "ts-node scripts/grant-admin.ts"
```

- [ ] **Step 3: Write `README.md`**

```markdown
# ecommerce-api

NestJS + Prisma + Postgres backend for the ecommerce platform. Owns all data
and all Stripe interaction. The Next.js storefront and React admin portal are
pure API clients.

## Local development

```bash
docker compose up -d db        # Postgres 16 on :5432
cp .env.example .env           # fill in Stripe + Firebase values
npx prisma migrate dev
npm run start:dev              # API on :3001, Swagger at /docs
```

## Stripe webhooks locally

```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
# copy the whsec_... it prints into .env as STRIPE_WEBHOOK_SECRET
```

## Granting admin access

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run grant-admin -- you@example.com
```

## Tests

```bash
npm test          # unit tests (no DB needed)
npm run test:e2e  # integration tests against ecommerce_test DB
```

## Key invariants

- Prices are integer cents; currency is USD.
- Stock decrements happen in the `checkout.session.completed` webhook,
  guarded so they can never go negative; refunds restore stock.
- Webhooks are idempotent: the dedup row and side effects share a transaction.
- Order status: PENDING → PAID → SHIPPED → DELIVERED (+ CANCELLED, REFUNDED).
```

- [ ] **Step 4: Verify**

```bash
npm run start &
sleep 5
curl -s http://localhost:3001/docs-json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(Object.keys(JSON.parse(d).paths).sort().join('\n')))"
kill %1
```
Expected paths include: `/health`, `/me`, `/me/addresses`, `/categories`, `/categories/{id}`, `/products`, `/products/{slug}`, `/products/{id}`, `/products/{id}/stock`, `/products/{productId}/reviews`, `/checkout`, `/orders`, `/orders/me`, `/orders/{id}`, `/orders/{id}/status`, `/orders/{id}/refund`, `/webhooks/stripe`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Swagger docs, grant-admin script, README"
```

---

### Task 12: End-to-end integration test (real DB, faked Firebase/Stripe)

**Files:**
- Create: `test/app.e2e-spec.ts`
- Modify: `test/jest-e2e.json` (if needed: ensure `rootDir` and ts-jest transform are the CLI defaults), `package.json` (`test:e2e` script)

**Interfaces:**
- Consumes: the full application; overrides `FirebaseService` (token `admin-token` → admin user, `customer-token` → customer) and `StripeService` (canned session, `constructWebhookEvent` returns the JSON payload as the event).
- Produces: proof of the whole happy path against a real Postgres: category → product → checkout → webhook completed → order paid + stock decremented → review by purchaser.

- [ ] **Step 1: Create the test database**

```bash
docker compose exec db psql -U ecommerce -c 'CREATE DATABASE ecommerce_test' || true
DATABASE_URL=postgresql://ecommerce:ecommerce@localhost:5432/ecommerce_test npx prisma migrate deploy
```

Add to `package.json` scripts:
```json
"test:e2e": "DATABASE_URL=postgresql://ecommerce:ecommerce@localhost:5432/ecommerce_test jest --config ./test/jest-e2e.json --runInBand"
```

- [ ] **Step 2: Write the failing e2e test**

`test/app.e2e-spec.ts`:
```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { StripeService } from '../src/stripe/stripe.service';
import { PrismaService } from '../src/prisma/prisma.service';

const fakeFirebase = {
  onModuleInit: () => undefined,
  verifyIdToken: (token: string) => {
    if (token === 'admin-token') {
      return Promise.resolve({ uid: 'admin-uid', email: 'admin@test.com', admin: true });
    }
    if (token === 'customer-token') {
      return Promise.resolve({ uid: 'customer-uid', email: 'customer@test.com' });
    }
    return Promise.reject(new Error('invalid'));
  },
};

const fakeStripe = {
  client: {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_1',
          url: 'https://stripe.test/cs_test_1',
        }),
      },
    },
    refunds: { create: jest.fn().mockResolvedValue({ id: 're_test_1' }) },
  },
  constructWebhookEvent: (payload: Buffer) =>
    JSON.parse(payload.toString()) as unknown,
};

describe('Ecommerce API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const admin = { Authorization: 'Bearer admin-token' };
  const customer = { Authorization: 'Bearer customer-token' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue(fakeFirebase)
      .overrideProvider(StripeService)
      .useValue(fakeStripe)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    // clean slate
    await prisma.review.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await prisma.processedStripeEvent.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  let categoryId: string;
  let productId: string;
  let orderId: string;

  it('admin creates a category and product', async () => {
    const cat = await request(app.getHttpServer())
      .post('/categories')
      .set(admin)
      .send({ name: 'Tees', slug: 'tees' })
      .expect(201);
    categoryId = cat.body.id;

    const prod = await request(app.getHttpServer())
      .post('/products')
      .set(admin)
      .send({
        name: 'Chiller Tee',
        slug: 'chiller-tee',
        description: 'Organic cotton tee',
        priceCents: 2500,
        images: ['https://example.com/tee.jpg'],
        stockQty: 10,
        categoryId,
      })
      .expect(201);
    productId = prod.body.id;
  });

  it('customer cannot create products', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set(customer)
      .send({})
      .expect(403);
  });

  it('public can browse products', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?category=tees')
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].slug).toBe('chiller-tee');
  });

  it('customer checks out and gets a session url', async () => {
    const res = await request(app.getHttpServer())
      .post('/checkout')
      .set(customer)
      .send({ items: [{ productId, quantity: 2 }] })
      .expect(201);
    expect(res.body.url).toBe('https://stripe.test/cs_test_1');
    orderId = res.body.orderId;
  });

  it('webhook marks the order paid and decrements stock', async () => {
    const event = {
      id: 'evt_e2e_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: { orderId },
          payment_intent: 'pi_e2e_1',
          amount_total: 5000,
          customer_details: { name: 'Cust Omer', address: { country: 'US' } },
        },
      },
    };
    await request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('stripe-signature', 'test-sig')
      .set('content-type', 'application/json')
      .send(event)
      .expect(201);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('PAID');
    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stockQty).toBe(8);

    // idempotency: replaying the same event changes nothing
    await request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('stripe-signature', 'test-sig')
      .set('content-type', 'application/json')
      .send(event)
      .expect(201);
    const productAfter = await prisma.product.findUnique({ where: { id: productId } });
    expect(productAfter?.stockQty).toBe(8);
  });

  it('customer sees the order in their history', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders/me')
      .set(customer)
      .expect(200);
    expect(res.body[0].id).toBe(orderId);
    expect(res.body[0].status).toBe('PAID');
  });

  it('purchaser can review; non-purchaser cannot', async () => {
    await request(app.getHttpServer())
      .post(`/products/${productId}/reviews`)
      .set(customer)
      .send({ rating: 5, text: 'Soft and great' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/products/${productId}/reviews`)
      .set(admin) // admin never bought it
      .send({ rating: 1, text: 'never bought' })
      .expect(403);

    const res = await request(app.getHttpServer())
      .get(`/products/${productId}/reviews`)
      .expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.averageRating).toBe(5);
  });

  it('admin ships the order', async () => {
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set(admin)
      .send({ status: 'SHIPPED' })
      .expect(200);
  });
});
```

- [ ] **Step 3: Run e2e to verify current state**

```bash
docker compose up -d db
npm run test:e2e
```
Expected: PASS if Tasks 1–11 were implemented correctly; any failure here is a real integration bug — fix the module wiring (most common: missing module import in `app.module.ts`) before proceeding.

- [ ] **Step 4: Run the full suite one last time**

```bash
npm test && npm run test:e2e
```
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: end-to-end happy path — catalog, checkout, webhook, stock, reviews, shipping"
```

---

## Post-plan checklist (not tasks — context for the human)

- Real Stripe test keys and a Firebase project are needed before the storefront phase; until then, unit tests and e2e (with fakes) fully cover the logic.
- Deployment (Cloud Run + Neon) is deliberately deferred to a later phase once the admin portal can exercise the API.
- Phase 2 (admin portal) consumes: `/docs-json` for client generation, `GET /products?all=true`, admin order endpoints, `PATCH /products/:id/stock`.
