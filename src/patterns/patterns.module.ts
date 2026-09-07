import { Module } from '@nestjs/common';
import { AdminPatternsController } from './admin-patterns.controller';
import { PatternsController } from './patterns.controller';
import { PatternsRepository } from './patterns.repository';
import { PatternsService } from './patterns.service';
import { LooksRepository } from '../looks/looks.repository';

@Module({
  controllers: [PatternsController, AdminPatternsController],
  providers: [PatternsService, PatternsRepository, LooksRepository],
})
export class PatternsModule {}
