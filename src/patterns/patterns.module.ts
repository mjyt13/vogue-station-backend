import { Module } from '@nestjs/common';
import { AdminPatternsController } from './admin-patterns.controller';
import { PatternsController } from './patterns.controller';
import { PatternsRepository } from './patterns.repository';
import { PatternsService } from './patterns.service';

@Module({
  controllers: [PatternsController, AdminPatternsController],
  providers: [PatternsService, PatternsRepository],
})
export class PatternsModule {}
