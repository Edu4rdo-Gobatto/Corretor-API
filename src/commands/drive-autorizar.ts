import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Autoriza a API a usar o Meu Drive do dono (escopo `drive.file`: só o que a própria API criar) e cria a pasta raiz.
 * Uso único: `npm run drive:autorizar`. Imprime as duas linhas para o `.env`; não grava arquivo nenhum.
 */
const ESCOPO = 'https://www.googleapis.com/auth/drive.file';
const PRAZO_MS = 5 * 60 * 1000;
const NOME_RAIZ = 'Corretor - Contratos';

async function aguardarCodigo(cliente: string): Promise<{ codigo: string; retorno: string; verificador: string }> {
  const verificador = randomBytes(32).toString('base64url');
  const desafio = createHash('sha256').update(verificador).digest('base64url');
  const estado = randomBytes(16).toString('base64url');

  return new Promise((resolver, rejeitar) => {
    const servidor = createServer((requisicao, resposta) => {
      const url = new URL(requisicao.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/') { resposta.writeHead(404).end(); return; }
      const codigo = url.searchParams.get('code');
      const valido = url.searchParams.get('state') === estado && Boolean(codigo);
      resposta.writeHead(valido ? 200 : 400, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end(valido ? 'Autorizado. Pode fechar esta aba e voltar ao terminal.' : 'Autorização recusada ou inválida.');
      clearTimeout(prazo);
      servidor.close();
      if (valido) resolver({ codigo: codigo!, retorno, verificador });
      else rejeitar(new Error(`Autorização não concluída (${url.searchParams.get('error') ?? 'retorno inválido'}).`));
    });
    let retorno = '';
    const prazo = setTimeout(() => { servidor.close(); rejeitar(new Error('Tempo esgotado: refaça o comando.')); }, PRAZO_MS);
    servidor.listen(0, '127.0.0.1', () => {
      retorno = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
      const consentimento = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      consentimento.search = new URLSearchParams({
        client_id: cliente, redirect_uri: retorno, response_type: 'code', scope: ESCOPO,
        access_type: 'offline', prompt: 'consent', state: estado, code_challenge: desafio, code_challenge_method: 'S256',
      }).toString();
      console.log('\nAbra este endereço no navegador e entre com a conta dona do Drive:\n');
      console.log(`${consentimento.toString()}\n`);
      console.log('Aguardando a autorização (até 5 minutos)...');
    });
  });
}

async function json(resposta: Response, falha: string): Promise<Record<string, unknown>> {
  if (!resposta.ok) throw new Error(`${falha} (HTTP ${resposta.status}).`);
  return await resposta.json() as Record<string, unknown>;
}

async function autorizar(): Promise<void> {
  const cliente = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const segredo = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  if (!cliente || !segredo) throw new Error('Preencha GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET no .env antes de autorizar.');

  const { codigo, retorno, verificador } = await aguardarCodigo(cliente);
  const tokens = await json(await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: codigo, redirect_uri: retorno, client_id: cliente, client_secret: segredo, code_verifier: verificador }).toString(),
  }), 'Falha ao trocar o código pelo token');
  if (typeof tokens.refresh_token !== 'string' || typeof tokens.access_token !== 'string') {
    throw new Error('O Google não devolveu refresh token. Remova o acesso do app em myaccount.google.com/permissions e refaça.');
  }

  const pasta = await json(await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.access_token}` },
    body: JSON.stringify({ name: NOME_RAIZ, mimeType: 'application/vnd.google-apps.folder' }),
  }), 'Falha ao criar a pasta raiz no Drive');
  if (typeof pasta.id !== 'string') throw new Error('Resposta inválida do Google Drive ao criar a pasta raiz.');

  console.log(`\nPasta "${NOME_RAIZ}" criada no seu Meu Drive. Cole estas duas linhas no .env (e no Render):\n`);
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`GOOGLE_DRIVE_ROOT_FOLDER_ID=${pasta.id}\n`);
  console.log('O refresh token dá acesso às pastas criadas pela API: trate como senha e não comite.');
}

autorizar().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : 'Falha na autorização do Google Drive.');
  process.exitCode = 1;
});
