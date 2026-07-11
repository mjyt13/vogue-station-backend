/**
 * Writes the OpenAPI spec to docs/openapi.json without starting the HTTP
 * server (no DB connection is made). Run with: npm run openapi:emit
 * The frontend can commit/consume this file or generate a typed client
 * from it (openapi-typescript, orval, ...).
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFile } from 'node:fs/promises';
import { AppModule } from './app.module';
import { openApiConfig } from './openapi';

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    preview: true, // wire the module graph only; skip provider instantiation
  });
  const document = SwaggerModule.createDocument(app, openApiConfig);
  await writeFile('docs/openapi.json', JSON.stringify(document, null, 2));
  console.log(
    `docs/openapi.json written (${Object.keys(document.paths).length} paths)`,
  );
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
