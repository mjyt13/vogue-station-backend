import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ModerationStatus } from '../generated/prisma/enums';

/**
 * Shared moderation vocabulary for every moderatable entity
 * (patterns, models, colors, and looks).
 * The entity-specific part stays in each service (what to load, what
 * "confirmed" means, what a delist cascades to); the action → state
 * mapping lives here once.
 */
export const MODERATION_ACTIONS = ['approve', 'reject', 'delist'] as const;
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
  if (action === 'approve')
    return { status: ModerationStatus.APPROVED, isPublic: true };
  if (action === 'delist')
    return { status: ModerationStatus.DELISTED, isPublic: false };
  return { status: ModerationStatus.REJECTED, isPublic: false };
}
