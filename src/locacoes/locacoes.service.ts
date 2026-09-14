import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { dataCivilValida, decimalEmCentavos, documentoValido, escaparBusca } from '../comum/validacao';
import { DriveService } from '../drive/drive.service';
import { Comissao } from '../comissoes/comissao.entity';
import { Contrato } from './contrato.entity';
import { ParteLocacao } from './parte-locacao.entity';
import { AlterarContratoDto, AlterarParteLocacaoDto, ConsultaContratosDto, ConsultaPartesDto, CriarContratoDto, CriarParteLocacaoDto } from './locacoes.dto';

export const DATA_ATUAL_SQL = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/Cuiaba')::date";
export const hojeCivil = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

@Injectable()
export class LocacoesService {
  private readonly logger = new Logger(LocacoesService.name);
  constructor(private readonly banco: DataSource, private readonly drive: DriveService) {}

  private administrador(usuario: UsuarioAutenticado): void {
    if (usuario.cargo !== 'ADMIN') throw new ForbiddenException('Somente ADMIN pode alterar partes de locação.');
  }
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

  async listarPartes(consulta: ConsultaPartesDto, usuario: UsuarioAutenticado) {
    const busca = this.banco.getRepository(ParteLocacao).createQueryBuilder('parte');
    if (usuario.cargo !== 'ADMIN') busca.andWhere('EXISTS (SELECT 1 FROM contrato c WHERE c.corretor_id = :usuario AND (c.locador_id = parte.id OR c.locatario_id = parte.id))', { usuario: usuario.id });
    busca.andWhere('parte.ativo = :ativo', { ativo: consulta.ativo ?? true });
    if (consulta.papel) busca.andWhere('parte.papel = :papel', { papel: consulta.papel });
    if (consulta.cpf_cnpj) busca.andWhere('parte.cpf_cnpj LIKE :documento', { documento: `${consulta.cpf_cnpj}%` });
    if (consulta.busca) busca.andWhere('parte.nome ILIKE :busca', { busca: `%${escaparBusca(consulta.busca)}%` });
    const [itens, total] = await busca.orderBy('parte.nome', 'ASC').addOrderBy('parte.id', 'ASC').skip((consulta.pagina - 1) * consulta.limite).take(consulta.limite).getManyAndCount();
    return { itens, total, pagina: consulta.pagina, limite: consulta.limite };
  }

  async obterParte(id: string, usuario: UsuarioAutenticado): Promise<ParteLocacao> {
    const busca = this.banco.getRepository(ParteLocacao).createQueryBuilder('parte').where('parte.id = :id', { id });
    if (usuario.cargo !== 'ADMIN') busca.andWhere('EXISTS (SELECT 1 FROM contrato c WHERE c.corretor_id = :usuario AND (c.locador_id = parte.id OR c.locatario_id = parte.id))', { usuario: usuario.id });
    const parte = await busca.getOne();
    if (!parte) throw new NotFoundException('Parte de locação não encontrada.');
    return parte;
  }

  private validarParte(parte: Pick<ParteLocacao, 'tipo_pessoa' | 'cpf_cnpj' | 'data_nascimento'>): void {
    if (!documentoValido(parte.cpf_cnpj) || parte.cpf_cnpj.length !== (parte.tipo_pessoa === 'PF' ? 11 : 14)) throw new BadRequestException('CPF/CNPJ incompatível com o tipo de pessoa.');
    if (parte.data_nascimento && (parte.tipo_pessoa !== 'PF' || !dataCivilValida(parte.data_nascimento) || parte.data_nascimento > hojeCivil())) throw new BadRequestException('Data de nascimento inválida para a pessoa.');
  }

  async criarParte(dto: CriarParteLocacaoDto, usuario: UsuarioAutenticado): Promise<ParteLocacao> {
    this.administrador(usuario);
    const repositorio = this.banco.getRepository(ParteLocacao);
    const parte = repositorio.create({ ...dto, ativo: true, criado_por: usuario.id, alterado_por: usuario.id });
    this.validarParte(parte);
    return repositorio.save(parte);
  }

  async alterarParte(id: string, dto: AlterarParteLocacaoDto, usuario: UsuarioAutenticado): Promise<ParteLocacao> {
    this.administrador(usuario);
    return this.transacao(async gerenciador => {
      const parte = await gerenciador.findOne(ParteLocacao, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!parte) throw new NotFoundException('Parte de locação não encontrada.');
      const atualizada = Object.assign(new ParteLocacao(), parte, dto, { alterado_por: usuario.id });
      this.validarParte(atualizada);
      if (dto.ativo === false && await gerenciador.count(Contrato, { where: [{ locador_id: id, status: 'ATIVO' }, { locatario_id: id, status: 'ATIVO' }] })) throw new ConflictException('Parte vinculada a contrato ativo não pode ser desativada.');
      if (dto.papel && dto.papel !== parte.papel && await gerenciador.count(Contrato, { where: [{ locador_id: id }, { locatario_id: id }] })) throw new ConflictException('O papel de parte vinculada a contrato não pode ser alterado.');
      return gerenciador.save(atualizada);
    });
  }

  async listarContratos(consulta: ConsultaContratosDto, usuario: UsuarioAutenticado) {
    await this.expirar();
    const busca = this.banco.getRepository(Contrato).createQueryBuilder('contrato');
    if (usuario.cargo !== 'ADMIN') busca.andWhere('contrato.corretor_id = :usuario', { usuario: usuario.id });
    busca.andWhere('contrato.ativo = :ativo', { ativo: consulta.ativo ?? true });
    if (consulta.status) busca.andWhere('contrato.status = :status', { status: consulta.status });
    if (consulta.imovel_id) busca.andWhere('contrato.imovel_id = :imovel', { imovel: consulta.imovel_id });
    if (consulta.corretor_id) busca.andWhere('contrato.corretor_id = :corretor', { corretor: consulta.corretor_id });
    if (consulta.busca) busca.andWhere('contrato.numero_contrato ILIKE :busca', { busca: `%${escaparBusca(consulta.busca)}%` });
    const [itens, total] = await busca.orderBy('contrato.criado_em', 'DESC').addOrderBy('contrato.id', 'ASC').skip((consulta.pagina - 1) * consulta.limite).take(consulta.limite).getManyAndCount();
    return { itens, total, pagina: consulta.pagina, limite: consulta.limite };
  }

  async obterContrato(id: string, usuario: UsuarioAutenticado): Promise<Contrato> {
    await this.expirar();
    const contrato = await this.banco.getRepository(Contrato).findOneBy({ id });
    if (!contrato) throw new NotFoundException('Contrato não encontrado.');
    this.autorizar(contrato, usuario);
    return contrato;
  }

  private async validarContrato(contrato: Contrato, gerenciador: EntityManager): Promise<void> {
    if (!dataCivilValida(contrato.data_inicio) || !dataCivilValida(contrato.data_fim) || contrato.data_fim < contrato.data_inicio) throw new BadRequestException('Datas do contrato inválidas.');
    if (decimalEmCentavos(contrato.valor_aluguel) <= 0n || decimalEmCentavos(contrato.taxa_administracao) > 10000n) throw new BadRequestException('Valores do contrato inválidos.');
    if (!contrato.ativo || contrato.data_fim < hojeCivil()) contrato.status = 'INATIVO';
    if (contrato.locador_id === contrato.locatario_id) throw new BadRequestException('Locador e locatário devem ser partes distintas.');
    const imovel = await gerenciador.findOne(Imovel, { where: { id: contrato.imovel_id }, lock: { mode: 'pessimistic_write' } });
    const corretor = await gerenciador.findOne(Corretor, { where: { id: contrato.corretor_id }, lock: { mode: 'pessimistic_write' } });
    const partes = new Map<string, ParteLocacao>();
    for (const id of [contrato.locador_id, contrato.locatario_id].sort()) {
      const parte = await gerenciador.findOne(ParteLocacao, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (parte) partes.set(id, parte);
    }
    const locador = partes.get(contrato.locador_id); const locatario = partes.get(contrato.locatario_id);
    if (!imovel || !corretor || !locador || !locatario || locador.papel !== 'LOCADOR' || locatario.papel !== 'LOCATARIO') throw new BadRequestException('Imóvel, corretor ou partes do contrato inválidos.');
    if (contrato.status === 'ATIVO' && (!imovel.ativo || !corretor.ativo || !locador.ativo || !locatario.ativo)) throw new BadRequestException('Contrato ativo exige imóvel, corretor e partes ativos.');
  }

  async criarContrato(dto: CriarContratoDto, usuario: UsuarioAutenticado): Promise<Contrato> {
    if (usuario.cargo !== 'ADMIN' && dto.corretor_id !== usuario.id) throw new ForbiddenException('Corretor só pode criar contratos sob sua intermediação.');
    const contrato = await this.transacao(async gerenciador => {
      const novo = gerenciador.create(Contrato, { ...dto, ativo: true, status: dto.status ?? 'ATIVO', url_pasta_drive: null, status_pasta_drive: 'PENDENTE', criado_por: usuario.id, alterado_por: usuario.id });
      await this.validarContrato(novo, gerenciador);
      return gerenciador.save(novo);
    });
    return contrato.status === 'ATIVO' ? this.prepararPasta(contrato, usuario) : contrato;
  }

  async alterarContrato(id: string, dto: AlterarContratoDto, usuario: UsuarioAutenticado): Promise<Contrato> {
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
    return contrato.status === 'ATIVO' ? this.prepararPasta(contrato, usuario) : contrato;
  }

  private async prepararPasta(contrato: Contrato, usuario: UsuarioAutenticado): Promise<Contrato> {
    if (contrato.url_pasta_drive && contrato.status_pasta_drive === 'CRIADA') return contrato;
    const repositorio = this.banco.getRepository(Contrato);
    const versao = { id: contrato.id, numero_contrato: contrato.numero_contrato, locatario_id: contrato.locatario_id };
    await repositorio.update(versao, { status_pasta_drive: 'PENDENTE', alterado_por: usuario.id });
    try {
      const locatario = await this.banco.getRepository(ParteLocacao).findOneBy({ id: contrato.locatario_id });
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

  async repetirPasta(id: string, usuario: UsuarioAutenticado): Promise<Contrato> {
    const contrato = await this.obterContrato(id, usuario);
    if (!contrato.ativo || contrato.status !== 'ATIVO') throw new ConflictException('Somente contrato ativo pode preparar pasta no Drive.');
    return this.prepararPasta(contrato, usuario);
  }
}
