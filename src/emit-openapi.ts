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
  // Compiled output lands at dist/src/emit-openapi.js (src/ and scripts/ are
  // siblings under repo root, so tsc preserves that nesting) — go up two
  // levels to reach the repo root.
  const outPath = join(__dirname, '..', '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n');
  await app.close();
  console.log(`Wrote ${outPath}`);
}
void main();
