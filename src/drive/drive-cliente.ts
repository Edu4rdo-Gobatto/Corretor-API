import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
const ORIGEM = 'https://www.googleapis.com/drive/v3';
const MIME_PASTA = 'application/vnd.google-apps.folder';
const objeto = (valor: unknown): Record<string, unknown> => {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new ServiceUnavailableException('Resposta inválida do Google Drive.');
  return valor as Record<string, unknown>;
};
class ErroDrive extends Error { constructor(readonly status: number) { super('Google Drive indisponível.'); } }

@Injectable()
export class DriveCliente {
  private token?: { valor: string; expira: number };
  private renovacao?: Promise<string>;
  constructor(private readonly config: ConfigService) {}

  configuracao() {
    const cliente = this.config.get<string>('GOOGLE_DRIVE_CLIENT_ID');
    const segredo = this.config.get<string>('GOOGLE_DRIVE_CLIENT_SECRET');
    const renovacao = this.config.get<string>('GOOGLE_DRIVE_REFRESH_TOKEN');
    const raiz = this.config.get<string>('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    if (!cliente || !segredo || !renovacao || !raiz) throw new ServiceUnavailableException('Google Drive não configurado.');
    return { cliente, segredo, renovacao, raiz };
  }

  private async transporte(url: string, opcoes: RequestInit): Promise<Response> {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        const resposta = await fetch(url, { ...opcoes, redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (resposta.status !== 429 && resposta.status < 500) return resposta;
      } catch {
        // Erros externos nunca incluem credenciais nem dados pessoais em logs/respostas.
      }
      if (tentativa < 2) await new Promise<void>(resolve => setTimeout(resolve, 200 * 2 ** tentativa));
    }
    throw new ServiceUnavailableException('Google Drive temporariamente indisponível; tente novamente.');
  }

  private async renovarToken(): Promise<string> {
    // OAuth do dono no Meu Drive: o refresh token vem de `npm run drive:autorizar`, com escopo `drive.file`.
    const { cliente, segredo, renovacao } = this.configuracao();
    const resposta = await this.transporte('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: cliente, client_secret: segredo, refresh_token: renovacao }).toString(),
    });
    if (!resposta.ok) throw new ServiceUnavailableException('Falha na autenticação do Google Drive.');
    const corpo = objeto(await resposta.json());
    if (typeof corpo.access_token !== 'string' || typeof corpo.expires_in !== 'number') throw new ServiceUnavailableException('Resposta de autenticação do Google Drive inválida.');
    this.token = { valor: corpo.access_token, expira: Date.now() + Math.max(0, corpo.expires_in - 60) * 1000 };
    return corpo.access_token;
  }

  private async obterToken(): Promise<string> {
    if (this.token && this.token.expira > Date.now()) return this.token.valor;
    this.renovacao ??= this.renovarToken().finally(() => { this.renovacao = undefined; });
    return this.renovacao;
  }

  private async requisitar(caminho: string, opcoes: RequestInit = {}): Promise<Record<string, unknown>> {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const token = await this.obterToken();
      const resposta = await this.transporte(`${ORIGEM}${caminho}`, { ...opcoes, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (resposta.status === 401 && tentativa === 0) { this.token = undefined; continue; }
      if (!resposta.ok) throw new ErroDrive(resposta.status);
      return objeto(await resposta.json());
    }
    throw new ServiceUnavailableException('Falha na autenticação do Google Drive.');
  }

  async gerarId(): Promise<string> {
    const resposta = await this.requisitar('/files/generateIds?count=1&space=drive&type=files');
    const ids = resposta.ids;
    if (!Array.isArray(ids) || typeof ids[0] !== 'string' || !/^[\w-]+$/.test(ids[0])) throw new ServiceUnavailableException('Identificador inválido do Google Drive.');
    return ids[0];
  }

  async validarPastaPrivada(id: string, pai?: string): Promise<void> {
    const caminho = `/files/${encodeURIComponent(id)}`;
    const pasta = await this.requisitar(`${caminho}?supportsAllDrives=true&fields=id,mimeType,parents,trashed`);
    if (pasta.id !== id || pasta.mimeType !== MIME_PASTA || pasta.trashed !== false || (pai && (!Array.isArray(pasta.parents) || !pasta.parents.includes(pai)))) {
      throw new ServiceUnavailableException('Pasta inválida no Google Drive configurado.');
    }
    let pagina = '';
    do {
      const permissoes = await this.requisitar(`${caminho}/permissions?supportsAllDrives=true&pageSize=100&fields=nextPageToken,permissions(type)&pageToken=${encodeURIComponent(pagina)}`);
      if (!Array.isArray(permissoes.permissions) || permissoes.permissions.some(permissao => ['anyone', 'domain'].includes(String(objeto(permissao).type)))) {
        throw new ServiceUnavailableException('A pasta do Google Drive deve ter acesso restrito a usuários e grupos autorizados.');
      }
      pagina = typeof permissoes.nextPageToken === 'string' ? permissoes.nextPageToken : '';
    } while (pagina);
  }

  async criarPasta(id: string, nome: string, pai: string): Promise<string> {
    try {
      await this.requisitar('/files?supportsAllDrives=true&fields=id', { method: 'POST', body: JSON.stringify({ id, name: nome, mimeType: MIME_PASTA, parents: [pai] }) });
    } catch (erro) {
      // O mesmo ID confirma a criação anterior mesmo após timeout ou reinício do processo.
      if (!(erro instanceof ErroDrive && erro.status === 409)) throw erro;
      await this.validarPastaPrivada(id, pai);
      await this.requisitar(`/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id`, { method: 'PATCH', body: JSON.stringify({ name: nome }) });
    }
    await this.validarPastaPrivada(id, pai);
    return id;
  }
}
