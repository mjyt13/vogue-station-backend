import { Role } from '../generated/prisma/enums';
import type { GarmentModel, Prisma } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';

/**
 * Single source of truth for "who may see a garment model", in two dialects:
 * a Prisma filter for paginated lists (must run in SQL) and a predicate for
 * single loaded rows. Change visibility rules HERE and nowhere else.
 */
export const modelPolicy = {
  /** Catalog + approved public models + the caller's own (if signed in). */
  whereVisibleTo(
    user: AccessTokenPayload | undefined,
  ): Prisma.GarmentModelWhereInput {
    return {
      OR: [
        { ownerId: null, confirmed: true },
        { isPublic: true, status: 'APPROVED', confirmed: true },
        ...(user ? [{ ownerId: user.sub }] : []),
      ],
    };
  },

  /** Same rule for one row; admins additionally see everything. */
  canSee(user: AccessTokenPayload | undefined, model: GarmentModel): boolean {
    return (
      model.ownerId === null ||
      model.ownerId === user?.sub ||
      (model.isPublic && model.status === 'APPROVED') ||
      user?.role === Role.ADMIN
    );
  },
};
