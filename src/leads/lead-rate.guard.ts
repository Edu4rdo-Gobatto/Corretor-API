import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request } from 'express';

@Injectable()
export class LeadRateGuard implements CanActivate {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = createHash('sha256').update(request.ip ?? request.socket.remoteAddress ?? 'unknown').digest('hex');
    const now = Date.now(); const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + 60 * 60 * 1000 } : current;
    bucket.count += 1; this.buckets.set(key, bucket);
    if (bucket.count > 30) throw new HttpException('Muitas solicitações. Tente novamente mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
