import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { Role } from '../generated/prisma/enums';
import { RefreshTokenRepository } from '../auth/refresh-token.repository';
import { ModelsRepository } from '../models/models.repository';
import { PatternsRepository } from '../patterns/patterns.repository';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import type { User } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';

const admin: AccessTokenPayload = {
  sub: 'a1',
  email: 'admin@x.y',
  role: Role.ADMIN,
};

const user: User = {
  id: 'u1',
  email: 'a@b.c',
  passwordHash: '',
  role: Role.USER,
  bio: null,
  createdAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  const usersRepo = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findPage: jest.fn(),
    findByIdWithCounts: jest.fn(),
    deleteById: jest.fn(),
  };
  const tokensRepo = { deleteAllForUser: jest.fn() };
  const patternsRepo = { findKeysByOwner: jest.fn().mockResolvedValue([]) };
  const modelsRepo = { findKeysByOwner: jest.fn().mockResolvedValue([]) };
  const storageMock = {
    getSignedUrl: jest.fn(),
    putSignedUrl: jest.fn(),
    delete: jest.fn(),
    getObject: jest.fn(),
    putObject: jest.fn(),
  };

  beforeAll(async () => {
    user.passwordHash = await argon2.hash('password123', {
      type: argon2.argon2id,
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    patternsRepo.findKeysByOwner.mockResolvedValue([]);
    modelsRepo.findKeysByOwner.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: usersRepo },
        { provide: RefreshTokenRepository, useValue: tokensRepo },
        { provide: PatternsRepository, useValue: patternsRepo },
        { provide: ModelsRepository, useValue: modelsRepo },
        { provide: STORAGE_PROVIDER, useValue: storageMock },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('changes the password and revokes all sessions', async () => {
    usersRepo.findById.mockResolvedValue(user);
    usersRepo.update.mockResolvedValue(user);

    await service.changePassword('u1', 'password123', 'new-password-1');

    const updateArg = usersRepo.update.mock.calls[0] as [
      string,
      { passwordHash: string },
    ];
    expect(
      await argon2.verify(updateArg[1].passwordHash, 'new-password-1'),
    ).toBe(true);
    expect(tokensRepo.deleteAllForUser).toHaveBeenCalledWith('u1');
  });

  it('rejects a wrong current password without touching anything', async () => {
    usersRepo.findById.mockResolvedValue(user);
    await expect(
      service.changePassword('u1', 'wrong', 'new-password-1'),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersRepo.update).not.toHaveBeenCalled();
    expect(tokensRepo.deleteAllForUser).not.toHaveBeenCalled();
  });

  it('refuses an admin changing their own role', async () => {
    await expect(service.changeRole(admin, 'a1', Role.USER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('revokes sessions on role change so the JWT role refreshes', async () => {
    usersRepo.findById.mockResolvedValue(user);
    usersRepo.update.mockResolvedValue({ ...user, role: Role.ADMIN });
    usersRepo.findByIdWithCounts.mockResolvedValue({
      ...user,
      role: Role.ADMIN,
      _count: { colors: 2, patterns: 1, looks: 3 },
    });

    const result = await service.changeRole(admin, 'u1', Role.ADMIN);

    // Role change must not touch the user's content.
    expect(result.counts).toEqual({ colors: 2, patterns: 1, looks: 3 });

    expect(usersRepo.update).toHaveBeenCalledWith('u1', { role: Role.ADMIN });
    expect(tokensRepo.deleteAllForUser).toHaveBeenCalledWith('u1');
  });

  it('deletes storage objects before the user row (GDPR cascade)', async () => {
    usersRepo.findById.mockResolvedValue(user);
    patternsRepo.findKeysByOwner.mockResolvedValue([
      { objectKey: 'patterns/u1/p1.png', thumbnailKey: 'thumbnails/p1.webp' },
      { objectKey: 'patterns/u1/p2.png', thumbnailKey: null },
    ]);

    await service.deleteByAdmin(admin, 'u1');

    expect(storageMock.delete).toHaveBeenCalledTimes(3);
    expect(storageMock.delete).toHaveBeenCalledWith('patterns/u1/p1.png');
    expect(storageMock.delete).toHaveBeenCalledWith('thumbnails/p1.webp');
    expect(usersRepo.deleteById).toHaveBeenCalledWith('u1');
  });

  it('requires password confirmation for self-deletion', async () => {
    usersRepo.findById.mockResolvedValue(user);
    await expect(service.deleteSelf('u1', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersRepo.deleteById).not.toHaveBeenCalled();

    await service.deleteSelf('u1', 'password123');
    expect(usersRepo.deleteById).toHaveBeenCalledWith('u1');
  });
});
