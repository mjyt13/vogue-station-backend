import { DocumentBuilder } from '@nestjs/swagger';
import { REFRESH_COOKIE } from './auth/auth.controller';

/** Shared by the live /docs endpoint and the openapi:emit script. */
export const openApiConfig = new DocumentBuilder()
  .setTitle('Vogue Station API')
  .setDescription(
    'Auth, garment models, colors, patterns and saved looks for the Vogue Station viewer.',
  )
  .setVersion('0.1.0')
  .addBearerAuth()
  .addCookieAuth(REFRESH_COOKIE)
  .build();
