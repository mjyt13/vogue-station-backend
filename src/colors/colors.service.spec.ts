import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '../generated/prisma/enums';
import { ColorsRepository } from './colors.repository';
import { ColorsService } from './colors.service';
import type { Color } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';

const ownColor: Color = {
  id: 'c1',
  name: 'Mine',
  hex: '#112233',
  ownerId: 'u1',
  isPublic: false,
  createdAt: new Date(),
};

const me: AccessTokenPayload = { sub: 'u1', email: 'a@b.c', role: Role.USER };
const other: AccessTokenPayload = {
  sub: 'u2',
  email: 'x@y.z',
  role: Role.USER,
};
const admin: AccessTokenPayload = {
  sub: 'a1',
  email: 'a@a.a',
  role: Role.ADMIN,
};

describe('ColorsService', () => {
  let service: ColorsService;
  const repoMock = {
    findPage: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    deleteById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ColorsService,
        { provide: ColorsRepository, useValue: repoMock },
      ],
    }).compile();
    service = moduleRef.get(ColorsService);
  });

  it('derives the owner from the session, not the client', async () => {
    repoMock.create.mockResolvedValue(ownColor);
    await service.create(me, { name: 'Mine', hex: '#112233' });
    expect(repoMock.create).toHaveBeenCalledWith({
      name: 'Mine',
      hex: '#112233',
      ownerId: 'u1',
    });
  });

  it('normalizes hex to lowercase', async () => {
    repoMock.create.mockResolvedValue(ownColor);
    await service.create(me, { name: 'Mine', hex: '#AABBCC' });
    expect(repoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ hex: '#aabbcc' }),
    );
  });

  it('lets the owner delete their color', async () => {
    repoMock.findById.mockResolvedValue(ownColor);
    await service.delete(me, 'c1');
    expect(repoMock.deleteById).toHaveBeenCalledWith('c1');
  });

  it("hides someone else's private color as 404", async () => {
    repoMock.findById.mockResolvedValue(ownColor);
    await expect(service.delete(other, 'c1')).rejects.toThrow(
      NotFoundException,
    );
    expect(repoMock.deleteById).not.toHaveBeenCalled();
  });

  it('rejects deleting a visible preset as 403 for non-admins', async () => {
    repoMock.findById.mockResolvedValue({ ...ownColor, ownerId: null });
    await expect(service.delete(other, 'c1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets an admin delete any color', async () => {
    repoMock.findById.mockResolvedValue(ownColor);
    await service.delete(admin, 'c1');
    expect(repoMock.deleteById).toHaveBeenCalledWith('c1');
  });
});
