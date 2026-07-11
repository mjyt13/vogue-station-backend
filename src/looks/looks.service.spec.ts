import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GarmentKind, ModerationStatus, Role } from '../generated/prisma/enums';
import { ColorsRepository } from '../colors/colors.repository';
import { ModelsRepository } from '../models/models.repository';
import { PatternsRepository } from '../patterns/patterns.repository';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import { LooksRepository } from './looks.repository';
import { LooksService } from './looks.service';
import type { LookWithPattern } from './looks.repository';
import type { AccessTokenPayload } from '../auth/auth.types';

const me: AccessTokenPayload = { sub: 'u1', email: 'a@b.c', role: Role.USER };
const other: AccessTokenPayload = {
  sub: 'u2',
  email: 'x@y.z',
  role: Role.USER,
};

const catalogModel = {
  id: 'm1',
  name: 'Tee',
  kind: GarmentKind.TSHIRT,
  objectKey: 'models/tee.glb',
  ownerId: null,
  isPublic: true,
  status: ModerationStatus.APPROVED,
  version: 1,
  createdAt: new Date(),
};

const myPattern = {
  id: 'p1',
  name: 'Dots',
  objectKey: 'patterns/u1/p1.png',
  thumbnailKey: 'thumbnails/patterns/p1.webp',
  mime: 'image/png',
  width: 512,
  height: 512,
  confirmed: true,
  ownerId: 'u1',
  publishRequested: false,
  isPublic: false,
  status: ModerationStatus.PENDING,
  createdAt: new Date(),
};

const baseLook: LookWithPattern = {
  id: 'l1',
  name: 'My look',
  ownerId: 'u1',
  garmentModelId: 'm1',
  colorId: null,
  colorHex: '#112233',
  patternId: 'p1',
  patternScale: 2,
  thumbnailKey: null,
  publishRequested: false,
  status: ModerationStatus.PENDING,
  isPublic: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  pattern: myPattern,
};

describe('LooksService', () => {
  let service: LooksService;
  const looksRepo = {
    findPage: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteById: jest.fn(),
  };
  const modelsRepo = { findById: jest.fn() };
  const colorsRepo = { findById: jest.fn() };
  const patternsRepo = { findById: jest.fn() };
  const storageMock = {
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/pattern'),
    putSignedUrl: jest.fn(),
    delete: jest.fn(),
    getObject: jest.fn(),
    putObject: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    storageMock.getSignedUrl.mockResolvedValue(
      'https://signed.example/pattern',
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        LooksService,
        { provide: LooksRepository, useValue: looksRepo },
        { provide: ModelsRepository, useValue: modelsRepo },
        { provide: ColorsRepository, useValue: colorsRepo },
        { provide: PatternsRepository, useValue: patternsRepo },
        { provide: STORAGE_PROVIDER, useValue: storageMock },
      ],
    }).compile();
    service = moduleRef.get(LooksService);
  });

  it('creates a look snapshotting the referenced color hex', async () => {
    modelsRepo.findById.mockResolvedValue(catalogModel);
    colorsRepo.findById.mockResolvedValue({
      id: 'c1',
      name: 'Navy',
      hex: '#1f3a5f',
      ownerId: null,
      isPublic: true,
      createdAt: new Date(),
    });
    looksRepo.create.mockResolvedValue({
      ...baseLook,
      colorId: 'c1',
      colorHex: '#1f3a5f',
      patternId: null,
      pattern: null,
    });

    const result = await service.create(me, {
      name: 'My look',
      garmentModelId: 'm1',
      colorId: 'c1',
    });

    expect(looksRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ colorHex: '#1f3a5f', ownerId: 'u1' }),
    );
    expect(result.material.color).toBe('#1f3a5f');
    expect(result.material.patternUrl).toBeNull();
  });

  it('requires colorId or colorHex', async () => {
    modelsRepo.findById.mockResolvedValue(catalogModel);
    await expect(
      service.create(me, { name: 'x', garmentModelId: 'm1' }),
    ).rejects.toThrow('Provide colorId or colorHex');
  });

  it('rejects an invisible garment model', async () => {
    modelsRepo.findById.mockResolvedValue({
      ...catalogModel,
      ownerId: 'someone-else',
      isPublic: false,
    });
    await expect(
      service.create(me, {
        name: 'x',
        garmentModelId: 'm1',
        colorHex: '#112233',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an unconfirmed pattern reference', async () => {
    modelsRepo.findById.mockResolvedValue(catalogModel);
    patternsRepo.findById.mockResolvedValue({ ...myPattern, confirmed: false });
    await expect(
      service.create(me, {
        name: 'x',
        garmentModelId: 'm1',
        colorHex: '#112233',
        patternId: 'p1',
      }),
    ).rejects.toThrow('Pattern upload is not confirmed');
  });

  it('resolves the GarmentMaterial contract with a signed patternUrl', async () => {
    looksRepo.findById.mockResolvedValue(baseLook);

    const result = await service.get(me, 'l1');

    expect(result.material).toEqual({
      color: '#112233',
      patternUrl: 'https://signed.example/pattern',
      patternScale: 2,
    });
    expect(storageMock.getSignedUrl).toHaveBeenCalledWith('patterns/u1/p1.png');
  });

  it('renders color-only when the referenced pattern was deleted (SetNull)', async () => {
    looksRepo.findById.mockResolvedValue({
      ...baseLook,
      patternId: null,
      pattern: null,
    });
    const result = await service.get(me, 'l1');
    expect(result.material.patternUrl).toBeNull();
    expect(result.material.color).toBe('#112233');
  });

  it("404s someone else's look", async () => {
    looksRepo.findById.mockResolvedValue(baseLook);
    await expect(service.get(other, 'l1')).rejects.toThrow(NotFoundException);
  });

  it('publish flags the look for moderation; approve makes it public', async () => {
    looksRepo.findById.mockResolvedValue(baseLook);
    looksRepo.update.mockImplementation((_id: string, data: object) =>
      Promise.resolve({ ...baseLook, ...data }),
    );

    const published = await service.publish(me, 'l1');
    expect(published.publishRequested).toBe(true);
    expect(published.isPublic).toBe(false);

    // Approval requires the referenced assets to be public themselves.
    modelsRepo.findById.mockResolvedValue(catalogModel);
    looksRepo.findById.mockResolvedValue({
      ...baseLook,
      publishRequested: true,
      pattern: {
        ...myPattern,
        isPublic: true,
        status: ModerationStatus.APPROVED,
      },
    });
    const approved = await service.moderate('l1', 'approve');
    expect(approved.status).toBe(ModerationStatus.APPROVED);
    expect(approved.isPublic).toBe(true);
  });

  it('refuses to approve a look whose pattern is still private', async () => {
    modelsRepo.findById.mockResolvedValue(catalogModel);
    looksRepo.findById.mockResolvedValue({
      ...baseLook,
      publishRequested: true, // pattern = myPattern: private, PENDING
    });
    await expect(service.moderate('l1', 'approve')).rejects.toThrow(
      'Approve the referenced pattern first',
    );
    // rejecting needs no such check
    looksRepo.update.mockResolvedValue({
      ...baseLook,
      publishRequested: true,
      status: ModerationStatus.REJECTED,
    });
    await expect(service.moderate('l1', 'reject')).resolves.toBeDefined();
  });

  it('refuses to moderate a look nobody asked to publish', async () => {
    looksRepo.findById.mockResolvedValue(baseLook);
    await expect(service.moderate('l1', 'approve')).rejects.toThrow(
      'has not requested publication',
    );
  });

  it('update with a bare hex detaches the color reference', async () => {
    looksRepo.findById.mockResolvedValue(baseLook);
    looksRepo.update.mockResolvedValue({
      ...baseLook,
      colorId: null,
      colorHex: '#aabbcc',
    });

    await service.update(me, 'l1', { colorHex: '#AABBCC' });

    expect(looksRepo.update).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ colorId: null, colorHex: '#aabbcc' }),
    );
  });
});
