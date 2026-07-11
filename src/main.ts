import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { openApiConfig } from './openapi';

async function bootstrap() {
  // Body parsing is registered manually so raw upload bytes streamed to
  // /storage/* are not consumed by the json/urlencoded parsers first.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  const skipStorage =
    (parser: (req: Request, res: Response, next: NextFunction) => void) =>
    (req: Request, res: Response, next: NextFunction) =>
      req.path.startsWith('/storage/') ? next() : parser(req, res, next);
  app.use(skipStorage(json({ limit: '1mb' })));
  app.use(skipStorage(urlencoded({ extended: true })));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173',
    credentials: true,
  });

  SwaggerModule.setup(
    'docs',
    app,
    () => SwaggerModule.createDocument(app, openApiConfig),
    { swaggerOptions: { persistAuthorization: true } },
  );

  await app.listen(config.get('PORT') ?? 3000);
}
void bootstrap();
