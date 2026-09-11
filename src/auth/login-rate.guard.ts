import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request } from 'express';

@Injectable()
export class LoginRateGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    for (const [key, attempt] of this.attempts) if (attempt.resetAt <= now) this.attempts.delete(key);
    const email: unknown = (request.body as { email?: unknown } | undefined)?.email;
    const accountKey = typeof email === 'string' ? createHash('sha256').update(email.trim().toLowerCase()).digest('hex') : 'invalid';
    const keys = [{ key: `ip:${request.ip ?? request.socket.remoteAddress}`, limit: 50 }, { key: `account:${accountKey}`, limit: 10 }];
    if (keys.some(({ key, limit }) => (this.attempts.get(key)?.count ?? 0) >= limit) || this.attempts.size > 10000) {
      throw new HttpException('Muitas tentativas. Tente novamente em 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
    for (const { key } of keys) {
      const attempt = this.attempts.get(key) ?? { count: 0, resetAt: now + 15 * 60 * 1000 };
      attempt.count += 1;
      this.attempts.set(key, attempt);
    }
    return true;
  }
}
