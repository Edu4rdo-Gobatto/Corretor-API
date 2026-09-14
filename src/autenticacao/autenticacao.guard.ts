import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AutenticacaoGuard extends AuthGuard('autenticacao-jwt') {}
