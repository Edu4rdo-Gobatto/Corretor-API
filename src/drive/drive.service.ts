import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DriveCliente } from './drive-cliente';
import { RegistroPastaDrive } from './registro-pasta-drive.entity';

@Injectable()
export class DriveService {
  constructor(private readonly banco: DataSource, private readonly cliente: DriveCliente) {}

  private async garantirPasta(chave: string, nome: string, pai: string, usuario: number): Promise<string> {
    const registro = await this.banco.transaction(async gerenciador => {
      await gerenciador.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`drive:${chave}`]);
      const repositorio = gerenciador.getRepository(RegistroPastaDrive);
      const existente = await repositorio.findOneBy({ chave });
      if (existente) {
        if (!existente.ativo || existente.pasta_pai_id !== pai) throw new ServiceUnavailableException('Configuração da pasta do Drive diverge do registro existente.');
        if (existente.nome === nome) return existente;
        existente.nome = nome; existente.alterado_por = usuario;
        return repositorio.save(existente);
      }
      const id = await this.cliente.gerarId();
      return repositorio.save(repositorio.create({ chave, nome, pasta_pai_id: pai, id_drive: id, ativo: true, criado_por: usuario, alterado_por: usuario }));
    });
    // Esta transação precisa estar confirmada antes de criar qualquer pasta remotamente.
    return this.cliente.criarPasta(registro.id_drive, registro.nome, registro.pasta_pai_id);
  }

  /** Extrai o ID da pasta a partir da URL gravada no contrato. */
  idPastaDaUrl(url: string | null): string {
    const id = url?.match(/^https:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)$/)?.[1];
    if (!id) throw new ServiceUnavailableException('A pasta do contrato ainda não está disponível.');
    return id;
  }

  async enviarDocumento(url: string | null, arquivo: { originalname: string; mimetype: string; buffer: Buffer }) {
    const pasta = this.idPastaDaUrl(url);
    const nome = Buffer.from(arquivo.originalname, 'latin1').toString('utf8').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 200) || 'documento';
    try {
      return await this.cliente.enviarArquivo(pasta, nome, arquivo.mimetype || 'application/octet-stream', arquivo.buffer);
    } catch (erro) {
      if (erro instanceof ServiceUnavailableException) throw erro;
      throw new ServiceUnavailableException(`O Google Drive não aceitou o arquivo "${nome}".`);
    }
  }

  async listarDocumentos(url: string | null) {
    const pasta = this.idPastaDaUrl(url);
    try { return await this.cliente.listarArquivos(pasta); } catch (erro) {
      if (erro instanceof ServiceUnavailableException) throw erro;
      throw new ServiceUnavailableException('Não foi possível listar os documentos do Google Drive.');
    }
  }

  async criarPastaContrato(contrato: { id: number; numero_contrato: string; locatario: string }, usuario: number): Promise<string> {
    try {
      const { raiz } = this.cliente.configuracao();
      await this.cliente.validarPastaPrivada(raiz);
      const id = await this.garantirPasta(`contrato:${contrato.id}`, `${contrato.numero_contrato} - ${contrato.locatario}`, raiz, usuario);
      return `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
    } catch {
      throw new ServiceUnavailableException('Não foi possível preparar a pasta privada do contrato no Google Drive. Tente novamente pela operação de pasta do contrato.');
    }
  }
}
