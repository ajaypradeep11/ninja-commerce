import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildSwaggerDocument } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.enableShutdownHooks();
  // Behind Cloud Run's proxy: trust the first hop so the client IP (and thus
  // rate-limiting keys) comes from X-Forwarded-For, not the proxy address.
  app.set('trust proxy', 1);
  app.use(helmet());
  const config = app.get(ConfigService);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGINS').split(','),
  });

  // Swagger UI exposes the full API surface; keep it out of production.
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, buildSwaggerDocument(app));
  }

  // Bind host: defaults to 0.0.0.0 (required by Cloud Run). Local dev sets
  // HOST=127.0.0.1 to keep the API — which may be wired to the live prod DB —
  // off the LAN unless LAN exposure is explicitly opted into.
  await app.listen(
    config.getOrThrow<number>('PORT'),
    process.env.HOST ?? '0.0.0.0',
  );
}
void bootstrap();
