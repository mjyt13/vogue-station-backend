import { Role } from '../generated/prisma/enums';
import type { Pattern, Prisma } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';

/** Single source of truth for pattern visibility — see models.policy.ts. */
export const patternPolicy = {
  /** Global presets + approved public patterns + the caller's own (if signed in). */
  whereVisibleTo(
    user: AccessTokenPayload | undefined,
  ): Prisma.PatternWhereInput {
    return {
      OR: [
        { ownerId: null, confirmed: true },
        { isPublic: true, status: 'APPROVED', confirmed: true },
        ...(user ? [{ ownerId: user.sub }] : []),
      ],
    };
  },

  canSee(user: AccessTokenPayload | undefined, pattern: Pattern): boolean {
    return (
      pattern.ownerId === null ||
      pattern.ownerId === user?.sub ||
      (pattern.isPublic && pattern.status === 'APPROVED') ||
      user?.role === Role.ADMIN
    );
  },
};
