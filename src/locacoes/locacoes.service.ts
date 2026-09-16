import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { Pessoa } from '../pessoas/pessoa.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { DATA_ATUAL_SQL, hojeCivil } from '../comum/datas';
import { dataCivilValida, decimalEmCentavos, escaparBusca } from '../comum/validacao';
import { DriveService } from '../drive/drive.service';
import { Comissao } from '../comissoes/comissao.entity';
import { Contrato, resposta_contrato } from './contrato.entity';
import { AlterarContratoDto, ConsultaContratosDto, CriarContratoDto } from './locacoes.dto';

const RELACOES = { imovel: true, locador: true, locatario: true } as const;

@Injectable()
export class LocacoesService {
  private readonly logger = new Logger(LocacoesService.name);
  constructor(private readonly banco: DataSource, private readonly drive: DriveService) {}

  private autorizar(contrato: Contrato, usuario: UsuarioAutenticado): void {
    if (usuario.cargo !== 'ADMIN' && contrato.corretor_id !== usuario.id) throw new NotFoundException('Contrato não encontrado.');
  }
  private async transacao<T>(operacao: (gerenciador: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await this.banco.transaction(async gerenciador => {
        await gerenciador.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['locacoes:integridade']);
        await this.expirar(gerenciador);
        return operacao(gerenciador);
      });
    } catch (erro) {
      if (erro && typeof erro === 'object' && 'code' in erro && erro.code === '23505') throw new ConflictException('Número de contrato já cadastrado ou imóvel com contrato ativo.');
      throw erro;
    }
  }
  private async expirar(gerenciador: Pick<EntityManager, 'query'> = this.banco.manager): Promise<void> {
    await gerenciador.query(`UPDATE contrato SET status = 'INATIVO', alterado_em = now(), alterado_por = NULL WHERE status = 'ATIVO' AND data_fim < ${DATA_ATUAL_SQL}`);
  }
  @Cron('0 * * * *', { timeZone: 'America/Cuiaba', waitForCompletion: true })
  async encerrarContratosVencidos(): Promise<void> {
    try { await this.expirar(); } catch { this.logger.error('Falha ao atualizar contratos vencidos.'); }
  }

  async listarContratos(consulta: ConsultaContratosDto, usuario: UsuarioAutenticado) {
    await this.expirar();
    const busca = this.banco.getRepository(Contrato).createQueryBuilder('contrato')
      .leftJoinAndSelect('contrato.imovel', 'imovel').leftJoinAndSelect('contrato.locador', 'locador').leftJoinAndSelect('contrato.locatario', 'locatario');
    if (usuario.cargo !== 'ADMIN') busca.andWhere('contrato.corretor_id = :usuario', { usuario: usuario.id });
    busca.andWhere('contrato.ativo = :ativo', { ativo: consulta.ativo ?? true });
    if (consulta.status) busca.andWhere('contrato.status = :status', { status: consulta.status });
    if (consulta.imovel_id) busca.andWhere('contrato.imovel_id = :imovel', { imovel: consulta.imovel_id });
    if (consulta.corretor_id) busca.andWhere('contrato.corretor_id = :corretor', { corretor: consulta.corretor_id });
    if (consulta.pessoa_id) busca.andWhere('(contrato.locador_id = :pessoa OR contrato.locatario_id = :pessoa)', { pessoa: consulta.pessoa_id });
    if (consulta.busca) busca.andWhere('(contrato.numero_contrato ILIKE :busca OR imovel.titulo ILIKE :busca OR locatario.nome ILIKE :busca)', { busca: `%${escaparBusca(consulta.busca)}%` });
    const [itens, total] = await busca.orderBy('contrato.criado_em', 'DESC').addOrderBy('contrato.id', 'ASC').skip((consulta.pagina - 1) * consulta.limite).take(consulta.limite).getManyAndCount();
    return { itens: itens.map(resposta_contrato), total, pagina: consulta.pagina, limite: consulta.limite, total_paginas: Math.ceil(total / consulta.limite) };
  }

  async obterContrato(id: number, usuario: UsuarioAutenticado) {
    await this.expirar();
    const contrato = await this.banco.getRepository(Contrato).findOne({ where: { id }, relations: RELACOES });
    if (!contrato) throw new NotFoundException('Contrato não encontrado.');
    this.autorizar(contrato, usuario);
    return resposta_contrato(contrato);
  }

  private async validarContrato(contrato: Contrato, gerenciador: EntityManager): Promise<void> {
    if (!dataCivilValida(contrato.data_inicio) || !dataCivilValida(contrato.data_fim) || contrato.data_fim < contrato.data_inicio) throw new BadRequestException('Datas do contrato inválidas.');
    if (decimalEmCentavos(contrato.valor_aluguel) <= 0n || decimalEmCentavos(contrato.taxa_administracao) > 10000n) throw new BadRequestException('Valores do contrato inválidos.');
    if (!contrato.ativo || contrato.data_fim < hojeCivil()) contrato.status = 'INATIVO';
    if (contrato.locador_id === contrato.locatario_id) throw new BadRequestException('Locador e locatário devem ser pessoas distintas.');
    const imovel = await gerenciador.findOne(Imovel, { where: { id: contrato.imovel_id }, lock: { mode: 'pessimistic_write' } });
    const corretor = await gerenciador.findOne(Corretor, { where: { id: contrato.corretor_id }, lock: { mode: 'pessimistic_write' } });
    const pessoas = new Map<number, Pessoa>();
    for (const id of [contrato.locador_id, contrato.locatario_id].sort((a, b) => a - b)) {
      const pessoa = await gerenciador.findOne(Pessoa, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (pessoa) pessoas.set(id, pessoa);
    }
    const locador = pessoas.get(contrato.locador_id); const locatario = pessoas.get(contrato.locatario_id);
    if (!imovel || !corretor || !locador || !locatario) throw new BadRequestException('Imóvel, corretor ou pessoas do contrato inválidos.');
    if (contrato.status === 'ATIVO' && (!imovel.ativo || !corretor.ativo || !locador.ativo || !locatario.ativo)) throw new BadRequestException('Contrato ativo exige imóvel, corretor e pessoas ativos.');
  }

  async criarContrato(dto: CriarContratoDto, usuario: UsuarioAutenticado) {
    if (usuario.cargo !== 'ADMIN' && dto.corretor_id !== usuario.id) throw new ForbiddenException('Corretor só pode criar contratos sob sua intermediação.');
    const contrato = await this.transacao(async gerenciador => {
      const novo = gerenciador.create(Contrato, { ...dto, ativo: true, status: dto.status ?? 'ATIVO', url_pasta_drive: null, status_pasta_drive: 'PENDENTE', criado_por: usuario.id, alterado_por: usuario.id });
      await this.validarContrato(novo, gerenciador);
      return gerenciador.save(novo);
    });
    return this.concluir(contrato.status === 'ATIVO' ? await this.prepararPasta(contrato, usuario) : contrato);
  }

  async alterarContrato(id: number, dto: AlterarContratoDto, usuario: UsuarioAutenticado) {
    const contrato = await this.transacao(async gerenciador => {
      const existente = await gerenciador.findOne(Contrato, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!existente) throw new NotFoundException('Contrato não encontrado.');
      this.autorizar(existente, usuario);
      if (usuario.cargo !== 'ADMIN' && dto.corretor_id && dto.corretor_id !== usuario.id) throw new ForbiddenException('Somente ADMIN pode trocar o intermediador.');
      if (dto.imovel_id && dto.imovel_id !== existente.imovel_id && await gerenciador.count(Comissao, { where: { contrato_id: id } })) throw new ConflictException('Contrato com comissão registrada não pode trocar de imóvel.');
      const atualizado = Object.assign(new Contrato(), existente, dto, { alterado_por: usuario.id });
      if ((dto.numero_contrato && dto.numero_contrato !== existente.numero_contrato) || (dto.locatario_id && dto.locatario_id !== existente.locatario_id)) atualizado.status_pasta_drive = 'PENDENTE';
      await this.validarContrato(atualizado, gerenciador);
      return gerenciador.save(atualizado);
    });
    return this.concluir(contrato.status === 'ATIVO' ? await this.prepararPasta(contrato, usuario) : contrato);
  }

  /** Recarrega o contrato com imóvel e pessoas para a resposta. */
  private async concluir(contrato: Contrato) {
    const completo = await this.banco.getRepository(Contrato).findOne({ where: { id: contrato.id }, relations: RELACOES });
    return resposta_contrato(completo ?? contrato);
  }

  private async prepararPasta(contrato: Contrato, usuario: UsuarioAutenticado): Promise<Contrato> {
    if (contrato.url_pasta_drive && contrato.status_pasta_drive === 'CRIADA') return contrato;
    const repositorio = this.banco.getRepository(Contrato);
    const versao = { id: contrato.id, numero_contrato: contrato.numero_contrato, locatario_id: contrato.locatario_id };
    await repositorio.update(versao, { status_pasta_drive: 'PENDENTE', alterado_por: usuario.id });
    try {
      const locatario = await this.banco.getRepository(Pessoa).findOneBy({ id: contrato.locatario_id });
      if (!locatario) throw new NotFoundException('Locatário não encontrado.');
      contrato.url_pasta_drive = await this.drive.criarPastaContrato({ id: contrato.id, numero_contrato: contrato.numero_contrato, locatario: locatario.nome }, usuario.id);
      contrato.status_pasta_drive = 'CRIADA';
    } catch {
      contrato.status_pasta_drive = 'FALHOU';
      // Contrato já salvo: o cliente recebe seu ID e pode repetir só a integração.
    }
    // Uma tentativa malsucedida concorrente nunca apaga o resultado de outra bem-sucedida.
    if (contrato.status_pasta_drive === 'CRIADA') {
      await repositorio.update(versao, { url_pasta_drive: contrato.url_pasta_drive, status_pasta_drive: 'CRIADA', alterado_por: usuario.id });
    } else {
      await repositorio.update({ ...versao, status_pasta_drive: 'PENDENTE' }, { status_pasta_drive: 'FALHOU', alterado_por: usuario.id });
    }
    return await repositorio.findOneBy({ id: contrato.id }) ?? contrato;
  }

  async repetirPasta(id: number, usuario: UsuarioAutenticado) {
    await this.expirar();
    const contrato = await this.banco.getRepository(Contrato).findOneBy({ id });
    if (!contrato) throw new NotFoundException('Contrato não encontrado.');
    this.autorizar(contrato, usuario);
    if (!contrato.ativo || contrato.status !== 'ATIVO') throw new ConflictException('Somente contrato ativo pode preparar pasta no Drive.');
    return this.concluir(await this.prepararPasta(contrato, usuario));
  }
}
