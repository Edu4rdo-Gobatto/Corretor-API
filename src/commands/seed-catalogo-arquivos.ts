import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, open, readFile, realpath, rename, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';

export class FalhaCarga extends Error {}
export const exigir = (condicao: unknown, mensagem: string): void => { if (!condicao) throw new FalhaCarga(mensagem); };
export const hash = (dados: string | Buffer): string => createHash('sha256').update(dados).digest('hex');
export const objeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null && !Array.isArray(valor);

export function validarDto<T extends object>(classe: ClassConstructor<T>, dados: object): T {
  const dto = plainToInstance(classe, dados);
  exigir(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length === 0, 'Manifesto ou cadastro não atende ao DTO vigente.');
  return dto;
}

export async function validarDiretorio(caminho: string): Promise<string> {
  exigir(isAbsolute(caminho), 'Diretório privado deve ser absoluto e existir previamente.');
  const resolvido = await realpath(caminho);
  exigir(!(await lstat(caminho)).isSymbolicLink(), 'Diretório privado não pode ser um link.');
  exigir(!/onedrive/i.test(resolvido), 'Credenciais e journal devem ficar fora do OneDrive.');
  exigir((await stat(resolvido)).isDirectory(), 'Diretório privado inválido.');
  if (process.platform === 'win32') {
    const script = "$ErrorActionPreference='Stop';$a=[System.IO.DirectoryInfo]::new($env:CODEX_CARGA_DIRETORIO_PRIVADO).GetAccessControl();$s=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;if(-not $a.AreAccessRulesProtected){exit 2};foreach($r in $a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])){if($r.AccessControlType -eq 'Allow' -and $r.IdentityReference.Value -notin @($s,'S-1-5-18','S-1-5-32-544')){exit 3}};[Console]::WriteLine('privado')";
    exigir(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, CODEX_CARGA_DIRETORIO_PRIVADO: resolvido } }).trim() === 'privado', 'ACL do diretório privado deve ser restrita ao usuário.');
  } else exigir(((await stat(resolvido)).mode & 0o077) === 0, 'Diretório privado deve ter permissão 0700.');
  return resolvido;
}

export async function lerJson(caminho: string): Promise<unknown> {
  exigir(!(await lstat(caminho)).isSymbolicLink(), 'Arquivo privado não pode ser um link.');
  const dados: unknown = JSON.parse(await readFile(caminho, 'utf8'));
  return dados;
}

export async function existe(caminho: string): Promise<boolean> {
  try { await stat(caminho); return true; } catch (erro) {
    if (objeto(erro) && erro.code === 'ENOENT') return false;
    throw erro;
  }
}

/** fsync antes do rename: a senha e o plano ficam duráveis antes de qualquer INSERT. */
export async function gravarPrivado(diretorio: string, nome: string, dados: string | Buffer): Promise<void> {
  exigir(/^[a-z0-9.-]+$/.test(nome), 'Nome de arquivo privado inválido.');
  const destino = join(diretorio, nome);
  if (await existe(destino)) exigir(!(await lstat(destino)).isSymbolicLink(), 'Arquivo privado não pode ser um link.');
  const temporario = join(diretorio, `${nome}.${randomBytes(8).toString('hex')}.tmp`);
  const arquivo = await open(temporario, 'wx', 0o600);
  try { await arquivo.writeFile(dados); await arquivo.sync(); } finally { await arquivo.close(); }
  await rename(temporario, destino);
}

export async function conferirBackup(caminho: string, destino: { host: string; banco: string }): Promise<void> {
  exigir(isAbsolute(caminho) && (await stat(caminho)).size > 0, 'Backup absoluto e não vazio é obrigatório.');
  const backup = await lerJson(caminho);
  exigir(objeto(backup) && backup.versao === 1 && objeto(backup.destino) && backup.destino.host === destino.host && backup.destino.banco === destino.banco
    && Array.isArray(backup.tabelas) && backup.tabelas.length > 0 && Array.isArray(backup.sequencias), 'Backup incompatível com o banco de destino ou incompleto.');
}
