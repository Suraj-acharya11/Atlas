import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export type AuthenticatedRequest = Request & { user: { userId: string } };

export function actingUserId(request: Request): string {
  const userId = (request as AuthenticatedRequest).user?.userId;
  if (!userId) throw new UnauthorizedException('Authenticated user is required');
  return userId;
}
