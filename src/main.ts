import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { REFRESH_COOKIE } from './auth/auth.controller';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173',
    credentials: true,
  });

  const openApiConfig = new DocumentBuilder()
    .setTitle('Vogue Station API')
    .setDescription(
      'Auth, garment models, colors, patterns and saved looks for the Vogue Station viewer.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE)
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    () => SwaggerModule.createDocument(app, openApiConfig),
    { swaggerOptions: { persistAuthorization: true } },
  );

  await app.listen(config.get('PORT') ?? 3000);
}
void bootstrap();
