import { Header } from '@nestjs/common';

/**
 * Leitura pública que pode ser compartilhada: o navegador sempre revalida (o cache do front é limpo a cada escrita
 * do painel), e a CDN da Vercel, que faz o proxy de `/api`, reaproveita a resposta entre visitantes por 30 s.
 * O Nest só aplica o cabeçalho em respostas de sucesso; erros não são cacheados.
 */
export const CachePublico = () => Header('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
