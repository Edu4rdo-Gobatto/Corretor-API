import { CookieOptions, Request } from 'express';

export const COOKIE_SESSAO = 'corretor_renovacao';

export function lerCookieSessao(requisicao: Request): string {
  const prefixo = `${COOKIE_SESSAO}=`;
  return requisicao.headers.cookie?.split(';').map(parte => parte.trim()).find(parte => parte.startsWith(prefixo))?.slice(prefixo.length) ?? '';
}

// Sem maxAge/expires: cookie de sessão, descartado ao fechar o navegador. A inatividade é controlada no banco.
export const opcoesCookieSessao = (): CookieOptions => ({ httpOnly: true, sameSite: 'strict', secure: true, path: '/' });
