import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { Imovel } from '../imoveis/imovel.entity';
import { resposta_midia } from '../imoveis/imoveis.resposta';
import { ImovelMidia, TipoMidia } from './imovel-midia.entity';
import { CriarVideoEmbedDto, ReordenarMidiasDto } from './midias.dto';
import { ArquivoMidia, TAMANHO_MAXIMO_VIDEO, validar_arquivo } from './validacao-arquivo';
import { normalizar_video_embed } from './video-embed';

export const R2_MIDIAS = 'R2_MIDIAS';
const BUCKET = 'corretor-midia';

@Injectable()
export class MidiasService {
  private readonly logger = new Logger(MidiasService.name);
  constructor(@InjectRepository(ImovelMidia) private readonly midias: Repository<ImovelMidia>, @Inject(R2_MIDIAS) private readonly armazenamento: S3Client, private readonly configuracao: ConfigService) {}

  async enviar(imovel_id: number, arquivos: ArquivoMidia[], usuario: UsuarioAutenticado) {
    if (!arquivos?.length || arquivos.length > 20) throw new BadRequestException('Envie de 1 a 20 arquivos.');
    const validados = arquivos.map((arquivo) => validar_arquivo(arquivo));
    if (arquivos.reduce((total, arquivo) => total + arquivo.size, 0) > 60 * 1024 * 1024) throw new BadRequestException('O lote de mídia deve ter no máximo 60 MB.');
    const url_base = this.configuracao.getOrThrow<string>('R2_PUBLIC_URL').replace(/\/$/, '');
    const chaves: string[] = [];
    try {
      const resultado = await this.midias.manager.transaction(async (gerenciador) => {
        await this.bloquear_imovel(gerenciador, imovel_id, usuario);
        const repositorio = gerenciador.getRepository(ImovelMidia);
        const existentes = await this.listar(repositorio, imovel_id);
        let possui_capa = existentes.some((midia) => midia.capa);
        const ordem_inicial = existentes.reduce((maximo, midia) => Math.max(maximo, midia.ordem + 1), 0);
        const novas: ImovelMidia[] = [];
        for (const [indice, arquivo] of arquivos.entries()) {
          const validado = validados[indice];
          const chave = `imoveis/${imovel_id}/${randomUUID()}${validado.extensao}`;
          // A tentativa também é compensada se o provedor armazenar antes de um timeout.
          chaves.push(chave);
          await this.armazenamento.send(new PutObjectCommand({ Bucket: BUCKET, Key: chave, Body: arquivo.buffer, ContentType: arquivo.mimetype }));
          const capa = !possui_capa && validado.tipo === TipoMidia.IMAGEM;
          possui_capa ||= capa;
          novas.push(repositorio.create({ imovel_id, tipo: validado.tipo, url: `${url_base}/${chave}`, chave_armazenamento: chave,
            ordem: ordem_inicial + indice, capa, criado_por: usuario.id, alterado_por: usuario.id }));
        }
        return repositorio.save(novas);
      });
      return resultado.map(resposta_midia);
    } catch (erro) {
      const compensacoes = await Promise.allSettled(chaves.map((chave) => this.armazenamento.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chave }))));
      if (compensacoes.some((resultado) => resultado.status === 'rejected')) {
        this.logger.error(`Falha na compensação do upload do imóvel ${imovel_id}; verificar objetos órfãos no R2.`);
        throw new ServiceUnavailableException('Upload não concluído; a limpeza de arquivos requer verificação operacional.');
      }
      throw erro;
    }
  }

  async adicionar_embed(imovel_id: number, dto: CriarVideoEmbedDto, usuario: UsuarioAutenticado) {
    const url = normalizar_video_embed(dto.url);
    if (!url) throw new BadRequestException('Informe um vídeo válido do YouTube ou Vimeo.');
    const resultado = await this.midias.manager.transaction(async (gerenciador) => {
      await this.bloquear_imovel(gerenciador, imovel_id, usuario);
      const repositorio = gerenciador.getRepository(ImovelMidia);
      const existentes = await this.listar(repositorio, imovel_id);
      return repositorio.save(repositorio.create({ imovel_id, tipo: TipoMidia.VIDEO_EMBED, url, chave_armazenamento: null,
        ordem: existentes.reduce((maximo, midia) => Math.max(maximo, midia.ordem + 1), 0), capa: false, criado_por: usuario.id, alterado_por: usuario.id }));
    });
    return resposta_midia(resultado);
  }

  async reordenar(imovel_id: number, dto: ReordenarMidiasDto, usuario: UsuarioAutenticado) {
    const resultado = await this.midias.manager.transaction(async (gerenciador) => {
      await this.bloquear_imovel(gerenciador, imovel_id, usuario);
      const repositorio = gerenciador.getRepository(ImovelMidia);
      const existentes = await this.listar(repositorio, imovel_id);
      const por_id = new Map(existentes.map((midia) => [midia.id, midia]));
      if (dto.midias_ids.length !== por_id.size || new Set(dto.midias_ids).size !== por_id.size || dto.midias_ids.some((id) => !por_id.has(id))) throw new BadRequestException('A ordem deve conter todas as mídias do imóvel, uma única vez.');
      return repositorio.save(dto.midias_ids.map((id, ordem) => Object.assign(por_id.get(id)!, { ordem, alterado_por: usuario.id })));
    });
    return resultado.map(resposta_midia);
  }

  async definir_capa(imovel_id: number, midia_id: number, usuario: UsuarioAutenticado) {
    const resultado = await this.midias.manager.transaction(async (gerenciador) => {
      await this.bloquear_imovel(gerenciador, imovel_id, usuario);
      const repositorio = gerenciador.getRepository(ImovelMidia);
      const selecionada = await repositorio.findOneBy({ id: midia_id, imovel_id });
      if (!selecionada) throw new NotFoundException('Mídia não encontrada.');
      if (selecionada.tipo !== TipoMidia.IMAGEM) throw new BadRequestException('A capa deve ser uma imagem.');
      await repositorio.update({ imovel_id, capa: true }, { capa: false, alterado_por: usuario.id });
      return repositorio.save(Object.assign(selecionada, { capa: true, alterado_por: usuario.id }));
    });
    return resposta_midia(resultado);
  }

  async excluir(imovel_id: number, midia_id: number, usuario: UsuarioAutenticado): Promise<void> {
    let restauracao: { chave: string; conteudo: Buffer; tipo_conteudo: string } | undefined;
    let exclusao_tentada = false;
    try {
      await this.midias.manager.transaction(async (gerenciador) => {
        await this.bloquear_imovel(gerenciador, imovel_id, usuario);
        const repositorio = gerenciador.getRepository(ImovelMidia);
        const selecionada = await repositorio.createQueryBuilder('midia').addSelect('midia.chave_armazenamento').where('midia.id = :midia_id AND midia.imovel_id = :imovel_id', { midia_id, imovel_id }).getOne();
        if (!selecionada) throw new NotFoundException('Mídia não encontrada.');
        if (selecionada.chave_armazenamento) {
          const chave = selecionada.chave_armazenamento;
          try {
            const objeto = await this.armazenamento.send(new GetObjectCommand({ Bucket: BUCKET, Key: chave }));
            if (!objeto.Body || (objeto.ContentLength ?? 0) > TAMANHO_MAXIMO_VIDEO) throw new ServiceUnavailableException('Não foi possível preparar a exclusão segura da mídia.');
            const conteudo = Buffer.from(await objeto.Body.transformToByteArray());
            if (conteudo.length > TAMANHO_MAXIMO_VIDEO) throw new ServiceUnavailableException('Mídia excede o limite de restauração segura.');
            restauracao = { chave, conteudo, tipo_conteudo: objeto.ContentType ?? 'application/octet-stream' };
          } catch (erro) {
            if (!(typeof erro === 'object' && erro !== null && 'name' in erro && erro.name === 'NoSuchKey')) throw erro;
          }
          exclusao_tentada = true;
          await this.armazenamento.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chave }));
        }
        await repositorio.remove(selecionada);
        const restantes = await this.listar(repositorio, imovel_id);
        const nova_capa = selecionada.capa ? restantes.find((midia) => midia.tipo === TipoMidia.IMAGEM)?.id : undefined;
        if (restantes.length) await repositorio.save(restantes.map((midia, ordem) => Object.assign(midia, { ordem, ...(nova_capa ? { capa: midia.id === nova_capa } : {}), alterado_por: usuario.id })));
      });
    } catch (erro) {
      if (exclusao_tentada && restauracao) {
        try { await this.armazenamento.send(new PutObjectCommand({ Bucket: BUCKET, Key: restauracao.chave, Body: restauracao.conteudo, ContentType: restauracao.tipo_conteudo })); }
        catch {
          this.logger.error(`Falha ao restaurar mídia ${midia_id} após exclusão não concluída; requer reparo operacional.`);
          throw new ServiceUnavailableException('A exclusão não foi concluída e a restauração do arquivo requer verificação operacional.');
        }
      }
      throw erro;
    }
  }

  private listar(repositorio: Repository<ImovelMidia>, imovel_id: number) { return repositorio.find({ where: { imovel_id }, order: { ordem: 'ASC', id: 'ASC' } }); }

  private async bloquear_imovel(gerenciador: EntityManager, id: number, usuario: UsuarioAutenticado) {
    const imovel = await gerenciador.getRepository(Imovel).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!imovel) throw new NotFoundException('Imóvel não encontrado.');
    if (usuario.cargo !== 'ADMIN' && imovel.corretor_id !== usuario.id) throw new ForbiddenException('Somente o corretor responsável ou ADMIN pode alterar as mídias.');
    return imovel;
  }
}
