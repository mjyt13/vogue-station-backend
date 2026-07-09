import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { dirname, extname } from 'node:path';
import { Public } from '../common/decorators/public.decorator';
import { LocalStorageProvider } from './local-storage.provider';

const MIME_BY_EXT: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * Serves the LOCAL driver's "presigned" URLs. Access control is the HMAC
 * signature itself (like S3 presigning) — routes are @Public by design.
 * Not mounted in prod, where the S3 driver hands out real S3 URLs.
 */
@ApiExcludeController()
@Public()
@Controller('storage')
export class StorageController {
  constructor(private readonly localStorage: LocalStorageProvider) {}

  @Get('local/*key')
  async download(
    @Param('key') keyParts: string | string[],
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const key = this.checkSignature('GET', keyParts, expires, sig);
    const path = this.localStorage.resolveKey(key);
    const fileStat = await stat(path).catch(() => null);
    if (!fileStat?.isFile()) throw new NotFoundException('Object not found');

    res.setHeader(
      'Content-Type',
      MIME_BY_EXT[extname(key)] ?? 'application/octet-stream',
    );
    res.setHeader('Content-Length', fileStat.size);
    await pipeline(createReadStream(path), res);
  }

  @Put('local/*key')
  async upload(
    @Param('key') keyParts: string | string[],
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const key = this.checkSignature('PUT', keyParts, expires, sig);
    const path = this.localStorage.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await pipeline(req, createWriteStream(path));
    res.status(200).end();
  }

  private checkSignature(
    method: string,
    keyParts: string | string[],
    expires: string,
    sig: string,
  ): string {
    const key = Array.isArray(keyParts) ? keyParts.join('/') : keyParts;
    if (!this.localStorage.verify(method, key, Number(expires), sig ?? '')) {
      throw new ForbiddenException('Invalid or expired signature');
    }
    return key;
  }
}
