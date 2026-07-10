import { Role } from '../generated/prisma/enums';
import type { Pattern, Prisma } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';

/** Single source of truth for pattern visibility — see models.policy.ts. */
export const patternPolicy = {
  /** Global presets + approved public patterns + the caller's own. */
  whereVisibleTo(user: AccessTokenPayload): Prisma.PatternWhereInput {
    return {
      OR: [
        { ownerId: null, confirmed: true },
        { isPublic: true, status: 'APPROVED', confirmed: true },
        { ownerId: user.sub },
      ],
    };
  },

  canSee(user: AccessTokenPayload, pattern: Pattern): boolean {
    return (
      pattern.ownerId === null ||
      pattern.ownerId === user.sub ||
      (pattern.isPublic && pattern.status === 'APPROVED') ||
      user.role === Role.ADMIN
    );
  },
};
