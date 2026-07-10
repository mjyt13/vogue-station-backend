import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import { ModerationStatus, Role } from '../generated/prisma/enums';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import { PatternsRepository } from './patterns.repository';
import { PatternsService } from './patterns.service';
import type { Pattern } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';

const me: AccessTokenPayload = { sub: 'u1', email: 'a@b.c', role: Role.USER };
const other: AccessTokenPayload = {
  sub: 'u2',
  email: 'x@y.z',
  role: Role.USER,
};

const basePattern: Pattern = {
  id: 'p1',
  name: 'Dots',
  objectKey: 'patterns/u1/p1.png',
  thumbnailKey: null,
  mime: 'image/png',
  width: null,
  height: null,
  confirmed: false,
  ownerId: 'u1',
  isPublic: false,
  status: ModerationStatus.PENDING,
  createdAt: new Date(),
};

describe('PatternsService', () => {
  let service: PatternsService;
  const repoMock = {
    findPage: jest.fn(),
    findById: jest.fn(),
    create: jest.fn<
      Promise<unknown>,
      [{ ownerId: string; objectKey: string }]
    >(),
    update: jest.fn(),
    deleteById: jest.fn(),
  };
  const storageMock = {
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/get'),
    putSignedUrl: jest.fn().mockResolvedValue('https://signed.example/put'),
    delete: jest.fn(),
    getObject: jest.fn(),
    putObject: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    storageMock.getSignedUrl.mockResolvedValue('https://signed.example/get');
    storageMock.putSignedUrl.mockResolvedValue('https://signed.example/put');
    const moduleRef = await Test.createTestingModule({
      providers: [
        PatternsService,
        { provide: PatternsRepository, useValue: repoMock },
        { provide: STORAGE_PROVIDER, useValue: storageMock },
      ],
    }).compile();
    service = moduleRef.get(PatternsService);
  });

  it('creates an upload intent owned by the session user', async () => {
    repoMock.create.mockResolvedValue(basePattern);
    const result = await service.create(me, {
      name: 'Dots',
      mime: 'image/png',
    });
    const [createArgs] = repoMock.create.mock.calls[0];
    expect(createArgs.ownerId).toBe('u1');
    expect(createArgs.objectKey).toMatch(/^patterns\/u1\/.+\.png$/);
    expect(result.uploadUrl).toBe('https://signed.example/put');
  });

  it('confirms a valid PNG upload and generates a thumbnail', async () => {
    const png = await sharp({
      create: { width: 64, height: 48, channels: 3, background: '#3a5f8f' },
    })
      .png()
      .toBuffer();
    repoMock.findById.mockResolvedValue(basePattern);
    storageMock.getObject.mockResolvedValue(png);
    repoMock.update.mockImplementation((_id: string, data: object) =>
      Promise.resolve({ ...basePattern, ...data }),
    );

    const result = await service.confirm(me, 'p1');

    expect(result.confirmed).toBe(true);
    expect(result.width).toBe(64);
    expect(result.height).toBe(48);
    const [thumbKey, thumbBuf] = storageMock.putObject.mock.calls[0] as [
      string,
      Buffer,
    ];
    expect(thumbKey).toBe('thumbnails/patterns/p1.webp');
    const thumbMeta = await sharp(thumbBuf).metadata();
    expect(thumbMeta.format).toBe('webp');
    expect(thumbMeta.width).toBe(256);
  });

  it('rejects bytes whose magic numbers do not match the declared mime', async () => {
    repoMock.findById.mockResolvedValue(basePattern);
    storageMock.getObject.mockResolvedValue(
      Buffer.from('this is definitely not a png, just text bytes'),
    );

    await expect(service.confirm(me, 'p1')).rejects.toThrow(
      BadRequestException,
    );
    expect(storageMock.delete).toHaveBeenCalledWith('patterns/u1/p1.png');
    expect(repoMock.update).not.toHaveBeenCalled();
  });

  it('rejects confirm when nothing was uploaded', async () => {
    repoMock.findById.mockResolvedValue(basePattern);
    storageMock.getObject.mockResolvedValue(null);
    await expect(service.confirm(me, 'p1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it("404s confirming someone else's pattern", async () => {
    repoMock.findById.mockResolvedValue(basePattern);
    await expect(service.confirm(other, 'p1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('approve makes the pattern public, reject does not', async () => {
    const confirmed = { ...basePattern, confirmed: true };
    repoMock.findById.mockResolvedValue(confirmed);
    repoMock.update.mockImplementation((_id: string, data: object) =>
      Promise.resolve({ ...confirmed, ...data }),
    );

    const approved = await service.moderate('p1', 'approve');
    expect(approved.status).toBe(ModerationStatus.APPROVED);
    expect(approved.isPublic).toBe(true);

    const rejected = await service.moderate('p1', 'reject');
    expect(rejected.status).toBe(ModerationStatus.REJECTED);
    expect(rejected.isPublic).toBe(false);
  });

  it('refuses to moderate an unconfirmed upload', async () => {
    repoMock.findById.mockResolvedValue(basePattern);
    await expect(service.moderate('p1', 'approve')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deletes storage objects along with the row', async () => {
    repoMock.findById.mockResolvedValue({
      ...basePattern,
      confirmed: true,
      thumbnailKey: 'thumbnails/patterns/p1.webp',
    });
    await service.delete(me, 'p1');
    expect(storageMock.delete).toHaveBeenCalledWith('patterns/u1/p1.png');
    expect(storageMock.delete).toHaveBeenCalledWith(
      'thumbnails/patterns/p1.webp',
    );
    expect(repoMock.deleteById).toHaveBeenCalledWith('p1');
  });
});
