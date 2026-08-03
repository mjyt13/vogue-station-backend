import { Role } from '../generated/prisma/enums';
import type { Color, Prisma } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';

/** Single source of truth for color visibility — see models.policy.ts. */
export const colorPolicy = {
  /** Global presets + public colors + the caller's own (if signed in). */
  whereVisibleTo(user: AccessTokenPayload | undefined): Prisma.ColorWhereInput {
    return {
      OR: [
        { ownerId: null },
        { isPublic: true },
        ...(user ? [{ ownerId: user.sub }] : []),
      ],
    };
  },

  canSee(user: AccessTokenPayload | undefined, color: Color): boolean {
    return (
      color.ownerId === null ||
      color.ownerId === user?.sub ||
      color.isPublic ||
      user?.role === Role.ADMIN
    );
  },
};
