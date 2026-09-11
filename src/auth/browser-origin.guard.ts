import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export function allowedOrigins(configuration: ConfigService): string[] {
  return configuration.get<string>('ALLOWED_ORIGINS', 'http://localhost:5173').split(',').map(origin => origin.trim());
}

@Injectable()
export class BrowserOriginGuard implements CanActivate {
  constructor(private readonly configuration: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.get('origin');
    const fetchSite = request.get('sec-fetch-site');
    if ((origin && !allowedOrigins(this.configuration).includes(origin))
      || (!origin && fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none')) {
      throw new ForbiddenException('Origem não autorizada.');
    }
    return true;
  }
}
