import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import { DriveCliente } from './drive-cliente';

describe('Drive compartilhado via Service Account', () => {
  const par = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const configuracao = new ConfigService({
    GOOGLE_DRIVE_CLIENT_EMAIL: 'teste@example.iam.gserviceaccount.com',
    GOOGLE_DRIVE_PRIVATE_KEY: par.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    GOOGLE_DRIVE_ROOT_FOLDER_ID: 'raiz', GOOGLE_DRIVE_SHARED_DRIVE_ID: 'compartilhado',
  });
  afterEach(() => jest.restoreAllMocks());
  it('recupera criação já confirmada no Drive usando o mesmo ID e não concede acesso público', async () => {
    const requisicoes: { url: string; corpo?: string }[] = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation((entrada, opcoes) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url; requisicoes.push({ url, corpo: typeof opcoes?.body === 'string' ? opcoes.body : undefined });
      if (url.includes('oauth2')) return Promise.resolve(Response.json({ access_token: 'token_teste', expires_in: 3600 }));
      if (opcoes?.method === 'POST') return Promise.resolve(Response.json({}, { status: 409 }));
      if (url.includes('/permissions')) return Promise.resolve(Response.json({ permissions: [{ type: 'group' }] }));
      return Promise.resolve(Response.json({ id: 'fixo', driveId: 'compartilhado', mimeType: 'application/vnd.google-apps.folder', parents: ['pai'], trashed: false }));
    });
    const cliente = new DriveCliente(configuracao);
    await expect(cliente.criarPasta('fixo', 'Contrato teste', 'pai')).resolves.toBe('fixo');
    expect(requisicoes.filter(r => r.url.includes('/files')).every(r => r.url.includes('supportsAllDrives=true'))).toBe(true);
    expect(requisicoes.filter(r => r.corpo?.includes('"id":"fixo"')).map(r => JSON.parse(r.corpo!) as unknown)).toEqual([{ id: 'fixo', name: 'Contrato teste', mimeType: 'application/vnd.google-apps.folder', parents: ['pai'] }]);
    expect(requisicoes.some(r => r.corpo?.includes('anyone'))).toBe(false);
  });
  it('renomeia a pasta existente no mesmo ID ao atualizar o contrato', async () => {
    const chamadas: { metodo: string; corpo?: string }[] = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation((entrada, opcoes) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      chamadas.push({ metodo: opcoes?.method ?? 'GET', corpo: typeof opcoes?.body === 'string' ? opcoes.body : undefined });
      if (url.includes('oauth2')) return Promise.resolve(Response.json({ access_token: 'token_teste', expires_in: 3600 }));
      if (opcoes?.method === 'POST') return Promise.resolve(Response.json({}, { status: 409 }));
      if (url.includes('/permissions')) return Promise.resolve(Response.json({ permissions: [{ type: 'user' }] }));
      return Promise.resolve(Response.json({ id: 'fixo', driveId: 'compartilhado', mimeType: 'application/vnd.google-apps.folder', parents: ['pai'], trashed: false }));
    });
    await new DriveCliente(configuracao).criarPasta('fixo', 'LOC-002 - Empresa Atualizada', 'pai');
    expect(chamadas.filter(c => c.metodo === 'PATCH').map(c => c.corpo)).toEqual([JSON.stringify({ name: 'LOC-002 - Empresa Atualizada' })]);
  });
  it('bloqueia pastas públicas e fora do Drive configurado', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(entrada => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      if (url.includes('oauth2')) return Promise.resolve(Response.json({ access_token: 'token_teste', expires_in: 3600 }));
      if (url.includes('/permissions')) return Promise.resolve(Response.json({ permissions: [{ type: 'anyone' }] }));
      return Promise.resolve(Response.json({ id: 'raiz', driveId: 'compartilhado', mimeType: 'application/vnd.google-apps.folder', trashed: false }));
    });
    await expect(new DriveCliente(configuracao).validarPastaPrivada('raiz')).rejects.toThrow('restrito');
  });
  it('retorna erro previsível sem segredo quando a configuração está ausente', async () => {
    await expect(new DriveCliente(new ConfigService({})).gerarId()).rejects.toThrow('Google Drive não configurado');
  });
});
