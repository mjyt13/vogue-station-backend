import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import type { User } from '../generated/prisma/client';
import type { AccessTokenPayload, AuthResult, PublicUser } from './auth.types';

@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    const days = Number(config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    this.refreshTtlMs = days * 24 * 60 * 60 * 1000;
  }

  async register(email: string, password: string): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    const user = await this.usersService.create(email, passwordHash);
    return this.issueTokens(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(email);
    // Verify against a dummy hash on unknown email to keep timing uniform.
    const hash =
      user?.passwordHash ??
      '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const valid = await argon2.verify(hash, password).catch(() => false);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(user);
  }

  async refresh(rawToken: string | undefined): Promise<AuthResult> {
    const stored = await this.findValidToken(rawToken);
    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Rotation: a refresh token is single-use.
    await this.refreshTokens.deleteById(stored.id);
    return this.issueTokens(stored.user);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    const stored = await this.findValidToken(rawToken);
    if (stored) {
      await this.refreshTokens.deleteById(stored.id);
    }
  }

  private async findValidToken(rawToken: string | undefined) {
    if (!rawToken) return null;
    const stored = await this.refreshTokens.findByHash(
      this.hashToken(rawToken),
    );
    if (!stored || stored.expiresAt <= new Date()) return null;
    return stored;
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    await this.refreshTokens.create({
      tokenHash: this.hashToken(refreshToken),
      userId: user.id,
      expiresAt: refreshExpiresAt,
    });

    return {
      user: this.toPublicUser(user),
      accessToken,
      refreshToken,
      refreshExpiresAt,
    };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      bio: user.bio,
      createdAt: user.createdAt,
    };
  }
}
