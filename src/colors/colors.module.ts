import { Module } from '@nestjs/common';
import { AdminColorsController } from './admin-colors.controller';
import { ColorsController } from './colors.controller';
import { ColorsRepository } from './colors.repository';
import { ColorsService } from './colors.service';
import { LooksRepository } from '../looks/looks.repository';

@Module({
  controllers: [ColorsController, AdminColorsController],
  providers: [ColorsService, ColorsRepository, LooksRepository],
})
export class ColorsModule {}
