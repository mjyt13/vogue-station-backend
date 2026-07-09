import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { ModelsRepository } from './models.repository';
import { ModelsService } from './models.service';

@Module({
  controllers: [ModelsController],
  providers: [ModelsService, ModelsRepository],
})
export class ModelsModule {}
