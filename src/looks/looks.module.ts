import { Module } from '@nestjs/common';
import { ColorsRepository } from '../colors/colors.repository';
import { ModelsRepository } from '../models/models.repository';
import { PatternsRepository } from '../patterns/patterns.repository';
import { LooksController } from './looks.controller';
import { LooksRepository } from './looks.repository';
import { LooksService } from './looks.service';

@Module({
  controllers: [LooksController],
  // Looks reference other features' data; reuse their repositories (read-only).
  providers: [
    LooksService,
    LooksRepository,
    ModelsRepository,
    ColorsRepository,
    PatternsRepository,
  ],
})
export class LooksModule {}
