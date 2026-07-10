import { Module } from '@nestjs/common';
import { AdminModelsController } from './admin-models.controller';
import { ModelsController } from './models.controller';
import { ModelsRepository } from './models.repository';
import { ModelsService } from './models.service';

@Module({
  controllers: [ModelsController, AdminModelsController],
  providers: [ModelsService, ModelsRepository],
})
export class ModelsModule {}
