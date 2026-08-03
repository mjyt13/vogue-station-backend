import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GarmentKind, ModerationStatus, Role } from '../generated/prisma/enums';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import { ModelsRepository } from './models.repository';
import { ModelsService } from './models.service';
import type { GarmentModel } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';

const baseModel: GarmentModel = {
  id: 'm1',
  name: 'Test Shirt',
  kind: GarmentKind.TSHIRT,
  objectKey: 'models/test.glb',
  thumbnailKey: null,
  confirmed: true,
  ownerId: 'owner-1',
  publishRequested: false,
  isPublic: false,
  status: ModerationStatus.PENDING,
  version: 1,
  createdAt: new Date(),
};

const owner: AccessTokenPayload = {
  sub: 'owner-1',
  email: 'o@x.y',
  role: Role.USER,
};
const stranger: AccessTokenPayload = {
  sub: 'other-1',
  email: 's@x.y',
  role: Role.USER,
};
const admin: AccessTokenPayload = {
  sub: 'admin-1',
  email: 'a@x.y',
  role: Role.ADMIN,
};

describe('ModelsService', () => {
  let service: ModelsService;
  const repoMock = { findPage: jest.fn(), findById: jest.fn() };
  const storageMock = {
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/x'),
    putSignedUrl: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    storageMock.getSignedUrl.mockResolvedValue('https://signed.example/x');
    const moduleRef = await Test.createTestingModule({
      providers: [
        ModelsService,
        { provide: ModelsRepository, useValue: repoMock },
        { provide: STORAGE_PROVIDER, useValue: storageMock },
      ],
    }).compile();
    service = moduleRef.get(ModelsService);
  });

  it('returns a signed URL and hides the raw object key', async () => {
    repoMock.findById.mockResolvedValue({ ...baseModel, ownerId: null });

    const result = await service.getWithUrl(stranger, 'm1');

    expect(result.glbUrl).toBe('https://signed.example/x');
    expect(result).not.toHaveProperty('objectKey');
    expect(storageMock.getSignedUrl).toHaveBeenCalledWith('models/test.glb');
  });

  it('lets the owner see their private pending model', async () => {
    repoMock.findById.mockResolvedValue(baseModel);
    await expect(service.getWithUrl(owner, 'm1')).resolves.toBeDefined();
  });

  it('hides private models from strangers with 404, without signing', async () => {
    repoMock.findById.mockResolvedValue(baseModel);
    await expect(service.getWithUrl(stranger, 'm1')).rejects.toThrow(
      NotFoundException,
    );
    expect(storageMock.getSignedUrl).not.toHaveBeenCalled();
  });

  it('lets an admin see any model', async () => {
    repoMock.findById.mockResolvedValue(baseModel);
    await expect(service.getWithUrl(admin, 'm1')).resolves.toBeDefined();
  });

  it('shows approved public models to everyone', async () => {
    repoMock.findById.mockResolvedValue({
      ...baseModel,
      isPublic: true,
      status: ModerationStatus.APPROVED,
    });
    await expect(service.getWithUrl(stranger, 'm1')).resolves.toBeDefined();
  });

  it('404s on a missing model', async () => {
    repoMock.findById.mockResolvedValue(null);
    await expect(service.getWithUrl(owner, 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });
});
