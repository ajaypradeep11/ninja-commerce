import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { BrandsModule } from './brands/brands.module';
import { ProductsModule } from './products/products.module';
import { StripeModule } from './stripe/stripe.module';
import { CheckoutModule } from './checkout/checkout.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AdminModule } from './admin/admin.module';

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
        // Transactional email (order status notifications). All optional:
        // with SMTP_HOST unset the API logs emails instead of sending them.
        SMTP_HOST: Joi.string().allow('').optional(),
        SMTP_PORT: Joi.number().default(587),
        SMTP_USER: Joi.string().allow('').optional(),
        SMTP_PASS: Joi.string().allow('').optional(),
        MAIL_FROM: Joi.string().default(
          'LocalNinja Support <support@localninja.ca>',
        ),
      }),
    }),
    // Global default rate limit: 100 requests / 60s per client IP.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    FirebaseModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    StripeModule,
    CheckoutModule,
    WebhooksModule,
    OrdersModule,
    ReviewsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
