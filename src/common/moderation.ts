import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ModerationStatus } from '../generated/prisma/enums';

/**
 * Shared moderation vocabulary for every moderatable entity
 * (patterns and looks today; colors could join later).
 * The entity-specific part stays in each service (what to load, what
 * "confirmed" means); the action → state mapping lives here once.
 */
export const MODERATION_ACTIONS = ['approve', 'reject'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export class ModerateDto {
  @ApiProperty({ enum: MODERATION_ACTIONS })
  @IsIn(MODERATION_ACTIONS)
  action: ModerationAction;
}

/** approve is the only path to isPublic — the plan's moderation gate. */
export function moderationUpdate(action: ModerationAction): {
  status: ModerationStatus;
  isPublic: boolean;
} {
  return action === 'approve'
    ? { status: ModerationStatus.APPROVED, isPublic: true }
    : { status: ModerationStatus.REJECTED, isPublic: false };
}
