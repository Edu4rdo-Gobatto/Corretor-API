import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager, In } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { decimalEmCentavos, escaparBusca } from '../comum/validacao';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { Imovel } from '../imoveis/imovel.entity';
import { Contrato } from '../locacoes/contrato.entity';
import { DATA_ATUAL_SQL, hojeCivil } from '../locacoes/locacoes.service';
import { Comissao } from './comissao.entity';
import { ParcelaComissao } from './parcela-comissao.entity';
import { AlterarComissaoDto, ConsultaComissoesDto, CriarComissaoDto, PagarParcelaDto } from './comissoes.dto';
import { distribuirParcelas, vencimentoMensal } from './parcelamento';

const formatarCentavos = (valor: bigint): string => `${valor / 100n}.${String(valor % 100n).padStart(2, '0')}`;

@Injectable()
export class ComissoesService {
  private readonly logger = new Logger(ComissoesService.name);
  constructor(private readonly banco: DataSource) {}

  private async transacao<T>(operacao: (gerenciador: EntityManager) => Promise<T>): Promise<T> {
    return this.banco.transaction(async gerenciador => {
      await gerenciador.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['comissoes:integridade']);
      return operacao(gerenciador);
    });
  }

  private async atualizarAtrasos(gerenciador: Pick<EntityManager, 'query'> = this.banco.manager): Promise<void> {
    await gerenciador.query(`UPDATE parcelas_comissao p SET status = 'ATRASADO', alterado_em = now(), alterado_por = NULL WHERE p.status = 'PENDENTE' AND p.ativo = true AND p.data_vencimento < ${DATA_ATUAL_SQL} AND EXISTS (SELECT 1 FROM comissoes c WHERE c.id = p.comissao_id AND c.ativo = true)`);
  }
  @Cron('5 * * * *', { timeZone: 'America/Cuiaba', waitForCompletion: true })
  async marcarParcelasAtrasadas(): Promise<void> {
    try { await this.atualizarAtrasos(); } catch { this.logger.error('Falha ao atualizar parcelas atrasadas.'); }
  }

  private async referencias(imovel_id: string, cliente_id: string, usuario: UsuarioAutenticado, gerenciador: EntityManager, bloquear = false) {
    const lock = bloquear ? { mode: 'pessimistic_write' as const } : undefined;
    const imovel = await gerenciador.findOne(Imovel, { where: { id: imovel_id }, lock });
    const cliente = await gerenciador.findOne(Cliente, { where: { id: cliente_id }, lock });
    if (!imovel || !cliente || (usuario.cargo !== 'ADMIN' && (imovel.corretor_id !== usuario.id || cliente.corretor_id !== usuario.id))) throw new NotFoundException('Comissão, imóvel ou cliente não encontrado.');
    return { imovel, cliente };
  }

  async criar(dto: CriarComissaoDto, usuario: UsuarioAutenticado): Promise<Comissao> {
    if ((dto.tipo_operacao === 'LOCACAO') !== Boolean(dto.contrato_id)) throw new BadRequestException('Locação exige contrato; venda não pode ter contrato de locação.');
    const valores = distribuirParcelas(dto.valor_total, dto.quantidade_parcelas);
    const datas = valores.map((_valor, indice) => vencimentoMensal(dto.primeiro_vencimento, indice));
    return this.transacao(async gerenciador => {
      // Contrato antes de imóvel: mesma ordem de lock da alteração de contratos.
      if (dto.contrato_id) {
        const contrato = await gerenciador.findOne(Contrato, { where: { id: dto.contrato_id }, lock: { mode: 'pessimistic_write' } });
        if (!contrato || !contrato.ativo || (usuario.cargo !== 'ADMIN' && contrato.corretor_id !== usuario.id)) throw new NotFoundException('Contrato não encontrado.');
        if (contrato.imovel_id !== dto.imovel_id) throw new BadRequestException('Contrato pertence a outro imóvel.');
      }
      const { imovel, cliente } = await this.referencias(dto.imovel_id, dto.cliente_id, usuario, gerenciador, true);
      if (!imovel.ativo || !cliente.ativo) throw new BadRequestException('Imóvel e cliente devem estar ativos para registrar comissão.');
      if (cliente.imovel_id && cliente.imovel_id !== imovel.id) throw new BadRequestException('Cliente está vinculado a outro imóvel.');
      if (cliente.corretor_id !== imovel.corretor_id) throw new BadRequestException('Cliente e imóvel devem ter o mesmo corretor responsável.');
      const comissao = await gerenciador.save(gerenciador.create(Comissao, {
        tipo_operacao: dto.tipo_operacao, contrato_id: dto.contrato_id ?? null, imovel_id: dto.imovel_id, cliente_id: dto.cliente_id,
        valor_total: dto.valor_total, quantidade_parcelas: dto.quantidade_parcelas, observacoes: dto.observacoes ?? null,
        ativo: true, criado_por: usuario.id, alterado_por: usuario.id,
      }));
      const hoje = hojeCivil();
      comissao.parcelas = await gerenciador.save(valores.map((valor, indice) => gerenciador.create(ParcelaComissao, {
        comissao_id: comissao.id, numero_parcela: indice + 1, data_vencimento: datas[indice], valor,
        status: datas[indice] < hoje ? 'ATRASADO' : 'PENDENTE', pago_em: null, observacao_pagamento: null,
        ativo: true, criado_por: usuario.id, alterado_por: usuario.id,
      })));
      return comissao;
    });
  }

  async listar(consulta: ConsultaComissoesDto, usuario: UsuarioAutenticado) {
    await this.atualizarAtrasos();
    const busca = this.banco.getRepository(Comissao).createQueryBuilder('comissao');
    if (usuario.cargo !== 'ADMIN') {
      busca.innerJoin('comissao.imovel', 'imovel').innerJoin('comissao.cliente', 'cliente');
      busca.andWhere('imovel.corretor_id = :usuario AND cliente.corretor_id = :usuario', { usuario: usuario.id });
    }
    busca.andWhere('comissao.ativo = :ativo', { ativo: consulta.ativo ?? true });
    if (consulta.imovel_id) busca.andWhere('comissao.imovel_id = :imovel', { imovel: consulta.imovel_id });
    if (consulta.cliente_id) busca.andWhere('comissao.cliente_id = :cliente', { cliente: consulta.cliente_id });
    if (consulta.contrato_id) busca.andWhere('comissao.contrato_id = :contrato', { contrato: consulta.contrato_id });
    if (consulta.tipo_operacao) busca.andWhere('comissao.tipo_operacao = :operacao', { operacao: consulta.tipo_operacao });
    if (consulta.busca) busca.andWhere('comissao.observacoes ILIKE :busca', { busca: `%${escaparBusca(consulta.busca)}%` });
    const [itens, total] = await busca.orderBy('comissao.criado_em', 'DESC').addOrderBy('comissao.id', 'ASC').skip((consulta.pagina - 1) * consulta.limite).take(consulta.limite).getManyAndCount();
    const parcelas = itens.length ? await this.banco.getRepository(ParcelaComissao).find({ where: { comissao_id: In(itens.map(item => item.id)) }, order: { numero_parcela: 'ASC' } }) : [];
    return { itens: itens.map(item => this.resposta(item, parcelas.filter(parcela => parcela.comissao_id === item.id))), total, pagina: consulta.pagina, limite: consulta.limite };
  }

  private resposta(comissao: Comissao, parcelas: ParcelaComissao[]) {
    const pago = parcelas.filter(p => p.status === 'PAGO').reduce((total, p) => total + decimalEmCentavos(p.valor), 0n);
    return { ...comissao, parcelas, valor_pago: formatarCentavos(pago), saldo_pendente: formatarCentavos(decimalEmCentavos(comissao.valor_total) - pago) };
  }

  async obter(id: string, usuario: UsuarioAutenticado) {
    await this.atualizarAtrasos();
    const comissao = await this.banco.getRepository(Comissao).findOneBy({ id });
    if (!comissao) throw new NotFoundException('Comissão não encontrada.');
    await this.referencias(comissao.imovel_id, comissao.cliente_id, usuario, this.banco.manager);
    const parcelas = await this.banco.getRepository(ParcelaComissao).find({ where: { comissao_id: id }, order: { numero_parcela: 'ASC' } });
    return this.resposta(comissao, parcelas);
  }

  async alterar(id: string, dto: AlterarComissaoDto, usuario: UsuarioAutenticado): Promise<Comissao> {
    return this.transacao(async gerenciador => {
      const comissao = await gerenciador.findOne(Comissao, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!comissao) throw new NotFoundException('Comissão não encontrada.');
      await this.referencias(comissao.imovel_id, comissao.cliente_id, usuario, gerenciador, true);
      Object.assign(comissao, dto, { alterado_por: usuario.id });
      await gerenciador.save(comissao);
      if (dto.ativo !== undefined) await gerenciador.update(ParcelaComissao, { comissao_id: id }, { ativo: dto.ativo, alterado_por: usuario.id });
      await this.atualizarAtrasos(gerenciador);
      return comissao;
    });
  }

  async pagarParcela(id: string, dto: PagarParcelaDto, usuario: UsuarioAutenticado): Promise<ParcelaComissao> {
    if (dto.confirmar_pagamento !== true || dto.observacao_pagamento.trim().length < 5) throw new BadRequestException('Confirme o pagamento e informe a referência do comprovante.');
    return this.transacao(async gerenciador => {
      const parcela = await gerenciador.findOne(ParcelaComissao, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!parcela) throw new NotFoundException('Parcela não encontrada.');
      const comissao = await gerenciador.findOne(Comissao, { where: { id: parcela.comissao_id }, lock: { mode: 'pessimistic_write' } });
      if (!comissao) throw new NotFoundException('Comissão não encontrada.');
      await this.referencias(comissao.imovel_id, comissao.cliente_id, usuario, gerenciador, true);
      if (!parcela.ativo || !comissao.ativo) throw new ConflictException('Comissão desativada não permite baixa.');
      if (parcela.status === 'PAGO') {
        if (parcela.observacao_pagamento !== dto.observacao_pagamento.trim()) throw new ConflictException('Parcela já paga com outro comprovante.');
        return parcela;
      }
      parcela.status = 'PAGO'; parcela.pago_em = new Date(); parcela.observacao_pagamento = dto.observacao_pagamento.trim(); parcela.alterado_por = usuario.id;
      return gerenciador.save(parcela);
    });
  }
}
