import { Role } from '../generated/prisma/enums';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export type PublicUser = {
  id: string;
  email: string;
  role: Role;
  bio: string | null;
  createdAt: Date;
};

export type AuthResult = {
  user: PublicUser;
  accessToken: string;
  /** Raw refresh token — set as an httpOnly cookie, never in the body. */
  refreshToken: string;
  refreshExpiresAt: Date;
};

declare module 'express' {
  interface Request {
    user?: AccessTokenPayload;
  }
}
