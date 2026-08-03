import { Module } from '@nestjs/common';
import { AdminColorsController } from './admin-colors.controller';
import { ColorsController } from './colors.controller';
import { ColorsRepository } from './colors.repository';
import { ColorsService } from './colors.service';

@Module({
  controllers: [ColorsController, AdminColorsController],
  providers: [ColorsService, ColorsRepository],
})
export class ColorsModule {}
