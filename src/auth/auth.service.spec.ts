import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { Role } from '../generated/prisma/enums';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import type { User } from '../generated/prisma/client';

const user: User = {
  id: 'u1',
  email: 'a@b.c',
  // argon2id hash of "password123", created in beforeAll
  passwordHash: '',
  role: Role.USER,
  bio: null,
  createdAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const usersMock = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };
  const refreshTokensMock = {
    create: jest.fn<
      Promise<unknown>,
      [{ tokenHash: string; userId: string; expiresAt: Date }]
    >(),
    deleteById: jest.fn(),
    findByHash: jest.fn(),
  };

  beforeAll(async () => {
    user.passwordHash = await argon2.hash('password123', {
      type: argon2.argon2id,
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: RefreshTokenRepository, useValue: refreshTokensMock },
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: 'test-secret',
            signOptions: { expiresIn: '15m' },
          }),
        },
        { provide: ConfigService, useValue: new ConfigService({}) },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  it('registers a new user and returns tokens', async () => {
    usersMock.findByEmail.mockResolvedValue(null);
    usersMock.create.mockResolvedValue(user);

    const result = await service.register('a@b.c', 'password123');

    expect(result.user).toEqual(
      expect.objectContaining({ id: 'u1', email: 'a@b.c', role: Role.USER }),
    );
    expect(result.user).not.toHaveProperty('passwordHash');
    const payload = await jwtService.verifyAsync<{ sub: string; role: Role }>(
      result.accessToken,
    );
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe(Role.USER);
    // refresh token stored hashed, never raw
    const [createArgs] = refreshTokensMock.create.mock.calls[0];
    expect(createArgs.tokenHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex'),
    );
  });

  it('rejects registration with a taken email', async () => {
    usersMock.findByEmail.mockResolvedValue(user);
    await expect(service.register('a@b.c', 'password123')).rejects.toThrow(
      ConflictException,
    );
  });

  it('logs in with correct credentials', async () => {
    usersMock.findByEmail.mockResolvedValue(user);
    const result = await service.login('a@b.c', 'password123');
    expect(result.accessToken).toBeTruthy();
  });

  it('rejects a wrong password and an unknown email alike', async () => {
    usersMock.findByEmail.mockResolvedValue(user);
    await expect(service.login('a@b.c', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
    usersMock.findByEmail.mockResolvedValue(null);
    await expect(service.login('x@y.z', 'password123')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rotates the refresh token on refresh', async () => {
    refreshTokensMock.findByHash.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      user,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.refresh('raw-token');

    expect(refreshTokensMock.deleteById).toHaveBeenCalledWith('rt1');
    expect(refreshTokensMock.create).toHaveBeenCalled();
    expect(result.accessToken).toBeTruthy();
  });

  it('rejects an expired or unknown refresh token', async () => {
    refreshTokensMock.findByHash.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      user,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(service.refresh('raw-token')).rejects.toThrow(
      UnauthorizedException,
    );

    refreshTokensMock.findByHash.mockResolvedValue(null);
    await expect(service.refresh('nope')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.refresh(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
