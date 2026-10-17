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
import { IndiceReajuste, TipoContrato } from '../cadastros-contrato/cadastros-contrato.entity';
import { Contrato, resposta_contrato } from './contrato.entity';
import { AlterarContratoDto, ConsultaContratosDto, CriarContratoDto, EncerrarContratoDto, RenovarContratoDto } from './locacoes.dto';

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
      if (erro && typeof erro === 'object' && 'code' in erro && erro.code === '23505') {
        const c1 = (erro as { constraint?: unknown }).constraint;
        const c2 = (erro as { driverError?: { constraint?: unknown } }).driverError?.constraint;
        const constraint = typeof c1 === 'string' ? c1 : typeof c2 === 'string' ? c2 : '';
        if (constraint === 'contrato_numero_contrato_key' || constraint.includes('numero_contrato')) {
          throw new ConflictException('O número de contrato informado já está cadastrado.');
        }
        if (constraint === 'unica_renovacao_contrato') throw new ConflictException('Este contrato já foi renovado.');
        if (constraint === 'unico_contrato_ativo_imovel') {
          throw new ConflictException('Este imóvel já possui um contrato ativo em vigor. Encerre o contrato anterior antes de cadastrar um novo.');
        }
        throw new ConflictException('Número de contrato já cadastrado ou imóvel com contrato ativo.');
      }
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
    return resposta_contrato(contrato, await this.renovacaoDe(contrato.id));
  }

  private async contratoComPasta(id: number, usuario: UsuarioAutenticado): Promise<Contrato> {
    const contrato = await this.banco.getRepository(Contrato).findOneBy({ id });
    if (!contrato) throw new NotFoundException('Contrato não encontrado.');
    this.autorizar(contrato, usuario);
    if (contrato.status_pasta_drive !== 'CRIADA' || !contrato.url_pasta_drive) throw new ConflictException('A pasta do contrato ainda não foi criada no Google Drive.');
    return contrato;
  }

  async listarDocumentos(id: number, usuario: UsuarioAutenticado) {
    const contrato = await this.contratoComPasta(id, usuario);
    return { itens: await this.drive.listarDocumentos(contrato.url_pasta_drive) };
  }

  async enviarDocumentos(id: number, arquivos: { originalname: string; mimetype: string; buffer: Buffer }[], usuario: UsuarioAutenticado) {
    if (!arquivos.length) throw new BadRequestException('Selecione ao menos um arquivo.');
    const contrato = await this.contratoComPasta(id, usuario);
    const enviados: { id: string; nome: string }[] = [];
    for (const arquivo of arquivos) enviados.push(await this.drive.enviarDocumento(contrato.url_pasta_drive, arquivo));
    return { itens: enviados };
  }

  private async renovacaoDe(id: number): Promise<number | null> {
    return (await this.banco.getRepository(Contrato).findOne({ where: { contrato_anterior_id: id, ativo: true }, select: { id: true } }))?.id ?? null;
  }

  private async validarContrato(contrato: Contrato, gerenciador: EntityManager, usuario: UsuarioAutenticado, anterior?: Contrato): Promise<void> {
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

    // GAP-01: corretor só pode vincular pessoas da própria carteira ou de contratos que intermedeia.
    if (usuario.cargo !== 'ADMIN') {
      for (const pessoa of [locador, locatario]) {
        if (pessoa.corretor_id === usuario.id) continue;
        // O contrato persistido já autorizava estas partes antes do PATCH.
        if (anterior?.corretor_id === usuario.id && [anterior.locador_id, anterior.locatario_id].includes(pessoa.id)) continue;
        const vinculoPrevio = await gerenciador.getRepository(Contrato).createQueryBuilder('c')
          .where('c.corretor_id = :corretorId', { corretorId: usuario.id })
          .andWhere('(c.locador_id = :pessoaId OR c.locatario_id = :pessoaId)', { pessoaId: pessoa.id })
          .andWhere(contrato.id ? 'c.id != :contratoId' : '1=1', { contratoId: contrato.id })
          .getExists();
        if (!vinculoPrevio) {
          throw new ForbiddenException('Você não possui autorização para vincular esta pessoa ao contrato.');
        }
      }
    }
  }

  /**
   * Grava referência e snapshot só quando a escolha muda; manter um cadastro já desativado é permitido.
   * Contrato legado (sem referência) precisa ser classificado em qualquer edição, exceto o arquivamento.
   */
  private async classificar(contrato: Contrato, dto: Partial<Pick<CriarContratoDto, 'tipo_contrato_id' | 'indice_reajuste_id'>>, gerenciador: EntityManager, anterior?: Contrato): Promise<void> {
    if (contrato.tipo_contrato_id === null || contrato.indice_reajuste_id === null) {
      throw new BadRequestException('Selecione o tipo de contrato e o índice de reajuste. Se não houver opções, um administrador deve cadastrá-los em Cadastros.');
    }
    if (dto.tipo_contrato_id !== undefined && dto.tipo_contrato_id !== anterior?.tipo_contrato_id) {
      const tipo = await gerenciador.findOneBy(TipoContrato, { id: dto.tipo_contrato_id });
      if (!tipo?.ativo) throw new BadRequestException('Tipo de contrato inexistente ou desativado.');
      contrato.tipo_contrato_nome = tipo.nome;
    }
    if (dto.indice_reajuste_id !== undefined && dto.indice_reajuste_id !== anterior?.indice_reajuste_id) {
      const indice = await gerenciador.findOneBy(IndiceReajuste, { id: dto.indice_reajuste_id });
      if (!indice?.ativo) throw new BadRequestException('Índice de reajuste inexistente ou desativado.');
      Object.assign(contrato, { indice_reajuste: indice.nome, indice_reajuste_nome: indice.nome, indice_reajuste_periodicidade_meses: indice.periodicidade_meses, indice_reajuste_regra: indice.regra });
    }
  }

  async criarContrato(dto: CriarContratoDto, usuario: UsuarioAutenticado) {
    if (usuario.cargo !== 'ADMIN' && dto.corretor_id !== usuario.id) throw new ForbiddenException('Corretor só pode criar contratos sob sua intermediação.');
    const contrato = await this.transacao(async gerenciador => {
      const novo = gerenciador.create(Contrato, { ...dto, ativo: true, status: dto.status ?? 'ATIVO', url_pasta_drive: null, status_pasta_drive: 'PENDENTE', criado_por: usuario.id, alterado_por: usuario.id });
      await this.classificar(novo, dto, gerenciador);
      await this.validarContrato(novo, gerenciador, usuario);
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
      // Encerrado antecipadamente, o fim é o do encerramento; mudar a data desfaria o registro sem deixar rastro.
      if (existente.motivo_encerramento && dto.data_fim !== undefined && dto.data_fim !== existente.data_fim) throw new ConflictException('Contrato encerrado antecipadamente não pode ter a data de fim alterada.');
      const atualizado = Object.assign(new Contrato(), existente, dto, { alterado_por: usuario.id });
      if ((dto.numero_contrato && dto.numero_contrato !== existente.numero_contrato) || (dto.locatario_id && dto.locatario_id !== existente.locatario_id)) atualizado.status_pasta_drive = 'PENDENTE';
      const somenteArquivamento = Object.keys(dto).every(campo => campo === 'ativo');
      if (!somenteArquivamento) await this.classificar(atualizado, dto, gerenciador, existente);
      await this.validarContrato(atualizado, gerenciador, usuario, existente);
      return gerenciador.save(atualizado);
    });
    return this.concluir(contrato.status === 'ATIVO' ? await this.prepararPasta(contrato, usuario) : contrato);
  }

  /**
   * Encerramento antecipado: `data_fim` passa a ser o último dia de vigência e o fim original fica em
   * `data_fim_contratada`. Data futura mantém o contrato ATIVO até lá; a expiração horária o inativa no dia seguinte.
   * Comissões e parcelas não mudam: a baixa ou o ajuste delas continua manual (RENTAL-004, validação contábil).
   */
  async encerrarContrato(id: number, dto: EncerrarContratoDto, usuario: UsuarioAutenticado) {
    const contrato = await this.transacao(async gerenciador => {
      const existente = await gerenciador.findOne(Contrato, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!existente) throw new NotFoundException('Contrato não encontrado.');
      this.autorizar(existente, usuario);
      if (!existente.ativo || existente.status !== 'ATIVO') throw new ConflictException('Somente contrato ativo pode ser encerrado.');
      if (existente.motivo_encerramento) throw new ConflictException('Este contrato já foi encerrado antecipadamente.');
      if (dto.data_encerramento < existente.data_inicio || dto.data_encerramento >= existente.data_fim) {
        throw new BadRequestException('A data de encerramento deve ficar entre o início do contrato e a véspera do fim contratado.');
      }
      Object.assign(existente, { data_fim_contratada: existente.data_fim, data_fim: dto.data_encerramento, motivo_encerramento: dto.motivo, alterado_por: usuario.id });
      if (existente.data_fim < hojeCivil()) existente.status = 'INATIVO';
      return gerenciador.save(existente);
    });
    return this.concluir(contrato);
  }

  /**
   * Renovação como contrato novo: copia imóvel, partes, intermediador e condições do anterior (o DTO pode trocar as
   * condições) e liga os dois por `contrato_anterior_id`. Como só um contrato pode estar ATIVO por imóvel, o anterior
   * passa a INATIVO na renovação; ele termina no próprio `data_fim` e a renovação começa depois dele, sem sobreposição.
   */
  async renovarContrato(id: number, dto: RenovarContratoDto, usuario: UsuarioAutenticado) {
    const contrato = await this.transacao(async gerenciador => {
      const anterior = await gerenciador.findOne(Contrato, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!anterior) throw new NotFoundException('Contrato não encontrado.');
      this.autorizar(anterior, usuario);
      if (!anterior.ativo) throw new ConflictException('Contrato arquivado não pode ser renovado.');
      if (anterior.motivo_encerramento) throw new ConflictException('Contrato encerrado antecipadamente não pode ser renovado; cadastre um contrato novo.');
      if (await gerenciador.exists(Contrato, { where: { contrato_anterior_id: id, ativo: true } })) throw new ConflictException('Este contrato já foi renovado.');
      if (dto.data_inicio <= anterior.data_fim) throw new BadRequestException('A renovação deve começar depois do fim do contrato anterior.');
      if (anterior.status === 'ATIVO') {
        anterior.status = 'INATIVO'; anterior.alterado_por = usuario.id;
        await gerenciador.save(anterior);
      }
      const novo = gerenciador.create(Contrato, {
        imovel_id: anterior.imovel_id, locador_id: anterior.locador_id, locatario_id: anterior.locatario_id, corretor_id: anterior.corretor_id,
        valor_aluguel: anterior.valor_aluguel, dia_vencimento: anterior.dia_vencimento, taxa_administracao: anterior.taxa_administracao,
        garantia_locaticia: anterior.garantia_locaticia, cobranca_iptu_condominio: anterior.cobranca_iptu_condominio,
        tipo_contrato_id: anterior.tipo_contrato_id, tipo_contrato_nome: anterior.tipo_contrato_nome,
        indice_reajuste: anterior.indice_reajuste, indice_reajuste_id: anterior.indice_reajuste_id, indice_reajuste_nome: anterior.indice_reajuste_nome,
        indice_reajuste_periodicidade_meses: anterior.indice_reajuste_periodicidade_meses, indice_reajuste_regra: anterior.indice_reajuste_regra,
        observacoes: null, ...dto, contrato_anterior_id: anterior.id, data_fim_contratada: null, motivo_encerramento: null,
        ativo: true, status: 'ATIVO', url_pasta_drive: null, status_pasta_drive: 'PENDENTE', criado_por: usuario.id, alterado_por: usuario.id,
      });
      // Contra o anterior: só re-tira o snapshot do que o DTO trocou; contrato legado sem classificação exige escolher.
      await this.classificar(novo, dto, gerenciador, anterior);
      await this.validarContrato(novo, gerenciador, usuario);
      return gerenciador.save(novo);
    });
    return this.concluir(contrato.status === 'ATIVO' ? await this.prepararPasta(contrato, usuario) : contrato);
  }

  /** Recarrega o contrato com imóvel e pessoas para a resposta. */
  private async concluir(contrato: Contrato) {
    const completo = await this.banco.getRepository(Contrato).findOne({ where: { id: contrato.id }, relations: RELACOES });
    return resposta_contrato(completo ?? contrato, await this.renovacaoDe(contrato.id));
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
