import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const MODERATION_ACTIONS = ['approve', 'reject'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export class ModeratePatternDto {
  @ApiProperty({ enum: MODERATION_ACTIONS })
  @IsIn(MODERATION_ACTIONS)
  action: ModerationAction;
}
