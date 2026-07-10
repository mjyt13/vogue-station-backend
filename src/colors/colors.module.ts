import { Module } from '@nestjs/common';
import { ColorsController } from './colors.controller';
import { ColorsRepository } from './colors.repository';
import { ColorsService } from './colors.service';

@Module({
  controllers: [ColorsController],
  providers: [ColorsService, ColorsRepository],
})
export class ColorsModule {}
