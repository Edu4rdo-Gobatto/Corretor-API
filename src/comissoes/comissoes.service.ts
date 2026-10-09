import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager, In } from 'typeorm';
import { Pessoa } from '../pessoas/pessoa.entity';
import { decimalEmCentavos, escaparBusca } from '../comum/validacao';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { Imovel } from '../imoveis/imovel.entity';
import { Contrato } from '../locacoes/contrato.entity';
import { DATA_ATUAL_SQL, hojeCivil } from '../comum/datas';
import { Comissao } from './comissao.entity';
import { ParcelaComissao } from './parcela-comissao.entity';
import { RevisaoComissao } from './revisao-comissao.entity';
import { AlterarComissaoDto, ConsultaComissoesDto, ConsultaPessoasElegiveisDto, CriarComissaoDto, PagarParcelaDto } from './comissoes.dto';
import { distribuirParcelas, vencimentoMensal } from './parcelamento';

const formatarCentavos = (valor: bigint): string => `${valor / 100n}.${String(valor % 100n).padStart(2, '0')}`;
const BLOQUEIO = { mode: 'pessimistic_write' as const };
const ordenados = (ids: Array<number | null>): number[] => [...new Set(ids.filter((id): id is number => id !== null))].sort((a, b) => a - b);

/** Dados que definem um plano de parcelas. Mudar qualquer um gera nova versão do plano. */
type Plano = Pick<RevisaoComissao, 'tipo_operacao' | 'contrato_id' | 'imovel_id' | 'pessoa_id' | 'valor_total' | 'quantidade_parcelas' | 'primeiro_vencimento'>;
const CAMPOS_PLANO = ['tipo_operacao', 'contrato_id', 'imovel_id', 'pessoa_id', 'valor_total', 'quantidade_parcelas', 'primeiro_vencimento'] as const;
/** Colunas do plano que ficam na própria comissão (o primeiro vencimento só existe na revisão e nas parcelas). */
const camposComissao = (plano: Plano) => ({ tipo_operacao: plano.tipo_operacao, contrato_id: plano.contrato_id, imovel_id: plano.imovel_id, pessoa_id: plano.pessoa_id, valor_total: plano.valor_total, quantidade_parcelas: plano.quantidade_parcelas });

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
    await gerenciador.query(`UPDATE parcelas_comissao p SET status = 'ATRASADO', alterado_em = now(), alterado_por = NULL WHERE p.status = 'PENDENTE' AND p.ativo = true AND p.data_vencimento < ${DATA_ATUAL_SQL} AND EXISTS (SELECT 1 FROM comissoes c WHERE c.id = p.comissao_id AND c.ativo = true AND c.versao_plano = p.versao_plano)`);
  }
  @Cron('5 * * * *', { timeZone: 'America/Cuiaba', waitForCompletion: true })
  async marcarParcelasAtrasadas(): Promise<void> {
    try { await this.atualizarAtrasos(); } catch { this.logger.error('Falha ao atualizar parcelas atrasadas.'); }
  }

  private async referencias(imovel_id: number, pessoa_id: number, usuario: UsuarioAutenticado, gerenciador: EntityManager, bloquear = false) {
    const lock = bloquear ? BLOQUEIO : undefined;
    const imovel = await gerenciador.findOne(Imovel, { where: { id: imovel_id }, lock });
    const pessoa = await gerenciador.findOne(Pessoa, { where: { id: pessoa_id }, lock });
    if (!imovel || !pessoa || (usuario.cargo !== 'ADMIN' && (imovel.corretor_id !== usuario.id || pessoa.corretor_id !== usuario.id))) throw new NotFoundException('Comissão, imóvel ou pessoa não encontrada.');
    return { imovel, pessoa };
  }

  /**
   * Regras de vínculo do POST, reaproveitadas na edição e na reativação. Trava contratos, depois imóveis e pessoas,
   * cada grupo em ordem de id — mesma ordem da alteração de contratos. `anterior` inclui no lock as referências atuais.
   */
  private async validarVinculos(alvo: Pick<Plano, 'tipo_operacao' | 'contrato_id' | 'imovel_id' | 'pessoa_id'>, usuario: UsuarioAutenticado, gerenciador: EntityManager, anterior?: Pick<Plano, 'contrato_id' | 'imovel_id' | 'pessoa_id'>): Promise<void> {
    if ((alvo.tipo_operacao === 'LOCACAO') !== Boolean(alvo.contrato_id)) throw new BadRequestException('Locação exige contrato; venda não pode ter contrato de locação.');
    const contratos = new Map<number, Contrato>();
    for (const id of ordenados([alvo.contrato_id, anterior?.contrato_id ?? null])) {
      const contrato = await gerenciador.findOne(Contrato, { where: { id }, lock: BLOQUEIO });
      if (contrato) contratos.set(id, contrato);
    }
    for (const id of ordenados([alvo.imovel_id, anterior?.imovel_id ?? null])) await gerenciador.findOne(Imovel, { where: { id }, lock: BLOQUEIO });
    for (const id of ordenados([alvo.pessoa_id, anterior?.pessoa_id ?? null])) await gerenciador.findOne(Pessoa, { where: { id }, lock: BLOQUEIO });
    if (alvo.contrato_id) {
      const contrato = contratos.get(alvo.contrato_id);
      if (!contrato || !contrato.ativo || (usuario.cargo !== 'ADMIN' && contrato.corretor_id !== usuario.id)) throw new NotFoundException('Contrato não encontrado.');
      if (contrato.imovel_id !== alvo.imovel_id) throw new BadRequestException('Contrato pertence a outro imóvel.');
    }
    const { imovel, pessoa } = await this.referencias(alvo.imovel_id, alvo.pessoa_id, usuario, gerenciador);
    if (!imovel.ativo || !pessoa.ativo) throw new BadRequestException('Imóvel e pessoa devem estar ativos para registrar comissão.');
    if (pessoa.imovel_id && pessoa.imovel_id !== imovel.id) throw new BadRequestException('Pessoa está vinculada a outro imóvel.');
    if (pessoa.corretor_id !== imovel.corretor_id) throw new BadRequestException('Pessoa e imóvel devem ter o mesmo corretor responsável.');
  }

  private async gerarPlano(gerenciador: EntityManager, comissao: Comissao, plano: Plano, usuario: UsuarioAutenticado, origem: 'CRIACAO' | 'EDICAO'): Promise<ParcelaComissao[]> {
    const valores = distribuirParcelas(plano.valor_total, plano.quantidade_parcelas);
    const datas = valores.map((_valor, indice) => vencimentoMensal(plano.primeiro_vencimento, indice));
    const hoje = hojeCivil();
    await gerenciador.insert(RevisaoComissao, { comissao_id: comissao.id, versao_plano: comissao.versao_plano, ...plano, autor_id: usuario.id, origem });
    return gerenciador.save(valores.map((valor, indice) => gerenciador.create(ParcelaComissao, {
      comissao_id: comissao.id, versao_plano: comissao.versao_plano, numero_parcela: indice + 1, data_vencimento: datas[indice], valor,
      status: datas[indice] < hoje ? 'ATRASADO' : 'PENDENTE', pago_em: null, observacao_pagamento: null,
      ativo: true, criado_por: usuario.id, alterado_por: usuario.id,
    })));
  }

  async criar(dto: CriarComissaoDto, usuario: UsuarioAutenticado) {
    const plano: Plano = {
      tipo_operacao: dto.tipo_operacao, contrato_id: dto.contrato_id ?? null, imovel_id: dto.imovel_id, pessoa_id: dto.pessoa_id,
      valor_total: dto.valor_total, quantidade_parcelas: dto.quantidade_parcelas, primeiro_vencimento: dto.primeiro_vencimento,
    };
    distribuirParcelas(plano.valor_total, plano.quantidade_parcelas);
    return this.transacao(async gerenciador => {
      await this.validarVinculos(plano, usuario, gerenciador);
      const comissao = await gerenciador.save(gerenciador.create(Comissao, {
        ...camposComissao(plano), observacoes: dto.observacoes ?? null, ativo: true, versao_plano: 1, versao_registro: 1, criado_por: usuario.id, alterado_por: usuario.id,
      }));
      const parcelas = await this.gerarPlano(gerenciador, comissao, plano, usuario, 'CRIACAO');
      return { ...this.resposta(comissao, parcelas), primeiro_vencimento: plano.primeiro_vencimento };
    });
  }

  async listar(consulta: ConsultaComissoesDto, usuario: UsuarioAutenticado) {
    await this.atualizarAtrasos();
    const busca = this.banco.getRepository(Comissao).createQueryBuilder('comissao');
    if (usuario.cargo !== 'ADMIN') {
      busca.innerJoin('comissao.imovel', 'imovel').innerJoin('comissao.pessoa', 'pessoa');
      busca.andWhere('imovel.corretor_id = :usuario AND pessoa.corretor_id = :usuario', { usuario: usuario.id });
    }
    busca.andWhere('comissao.ativo = :ativo', { ativo: consulta.ativo ?? true });
    if (consulta.imovel_id) busca.andWhere('comissao.imovel_id = :imovel', { imovel: consulta.imovel_id });
    if (consulta.pessoa_id) busca.andWhere('comissao.pessoa_id = :pessoa', { pessoa: consulta.pessoa_id });
    if (consulta.contrato_id) busca.andWhere('comissao.contrato_id = :contrato', { contrato: consulta.contrato_id });
    if (consulta.tipo_operacao) busca.andWhere('comissao.tipo_operacao = :operacao', { operacao: consulta.tipo_operacao });
    if (consulta.busca) busca.andWhere('comissao.observacoes ILIKE :busca', { busca: `%${escaparBusca(consulta.busca)}%` });
    const [itens, total] = await busca.orderBy('comissao.criado_em', 'DESC').addOrderBy('comissao.id', 'ASC').skip((consulta.pagina - 1) * consulta.limite).take(consulta.limite).getManyAndCount();
    const parcelas = itens.length ? await this.banco.getRepository(ParcelaComissao).find({ where: { comissao_id: In(itens.map(item => item.id)) }, order: { numero_parcela: 'ASC' } }) : [];
    // Só o plano vigente entra em saldos e listagens; planos substituídos ficam guardados.
    return { itens: itens.map(item => this.resposta(item, parcelas.filter(parcela => parcela.comissao_id === item.id && parcela.versao_plano === item.versao_plano))), total, pagina: consulta.pagina, limite: consulta.limite, total_paginas: Math.ceil(total / consulta.limite) };
  }

  /** Mesmas regras de pessoa do `criar`, aplicadas antes da paginação; o POST continua conferindo tudo. */
  async pessoasElegiveis(consulta: ConsultaPessoasElegiveisDto, usuario: UsuarioAutenticado) {
    const imovel = await this.banco.getRepository(Imovel).findOneBy({ id: consulta.imovel_id });
    if (!imovel || (usuario.cargo !== 'ADMIN' && imovel.corretor_id !== usuario.id)) throw new NotFoundException('Imóvel não encontrado.');
    const pagina = { pagina: consulta.pagina, limite: consulta.limite };
    if (!imovel.ativo) return { itens: [], total: 0, ...pagina, total_paginas: 0 };
    const busca = this.banco.getRepository(Pessoa).createQueryBuilder('pessoa').select(['pessoa.id', 'pessoa.nome', 'pessoa.criado_em'])
      .where('pessoa.ativo = true AND pessoa.corretor_id = :corretor', { corretor: imovel.corretor_id })
      .andWhere('(pessoa.imovel_id IS NULL OR pessoa.imovel_id = :imovel)', { imovel: imovel.id });
    if (consulta.pessoa_id) busca.andWhere('pessoa.id = :pessoa', { pessoa: consulta.pessoa_id });
    if (consulta.busca) {
      const termo = `%${escaparBusca(consulta.busca)}%`;
      const digitos = consulta.busca.replace(/\D/g, '');
      const telefone = /^(?:55)(?:\d{10}|\d{11})$/.test(digitos) ? digitos.slice(2) : digitos;
      busca.andWhere('(pessoa.nome ILIKE :termo OR pessoa.email ILIKE :termo' + (digitos ? " OR regexp_replace(pessoa.telefone, '\\D', '', 'g') LIKE :telefone OR pessoa.cpf_cnpj LIKE :digitos" : '') + ')', { termo, telefone: `%${telefone}%`, digitos: `%${digitos}%` });
    }
    const [itens, total] = await busca.orderBy('pessoa.criado_em', 'DESC').addOrderBy('pessoa.id', 'DESC')
      .skip((consulta.pagina - 1) * consulta.limite).take(consulta.limite).getManyAndCount();
    return { itens: itens.map(({ id, nome }) => ({ id, nome })), total, ...pagina, total_paginas: Math.ceil(total / consulta.limite) };
  }

  /** `parcelas` deve conter só o plano vigente. */
  private resposta(comissao: Comissao, parcelas: ParcelaComissao[]) {
    const pago = parcelas.filter(p => p.status === 'PAGO').reduce((total, p) => total + decimalEmCentavos(p.valor), 0n);
    return { ...comissao, parcelas, possui_recebimento: pago > 0n, valor_pago: formatarCentavos(pago), saldo_pendente: formatarCentavos(decimalEmCentavos(comissao.valor_total) - pago) };
  }

  private async detalhar(comissao: Comissao, gerenciador: EntityManager) {
    const parcelas = await gerenciador.find(ParcelaComissao, { where: { comissao_id: comissao.id, versao_plano: comissao.versao_plano }, order: { numero_parcela: 'ASC' } });
    const revisao = await gerenciador.findOneBy(RevisaoComissao, { comissao_id: comissao.id, versao_plano: comissao.versao_plano });
    return { ...this.resposta(comissao, parcelas), primeiro_vencimento: revisao?.primeiro_vencimento ?? parcelas[0]?.data_vencimento ?? null };
  }

  private async autorizada(id: number, usuario: UsuarioAutenticado) {
    const comissao = await this.banco.getRepository(Comissao).findOneBy({ id });
    if (!comissao) throw new NotFoundException('Comissão não encontrada.');
    await this.referencias(comissao.imovel_id, comissao.pessoa_id, usuario, this.banco.manager);
    return comissao;
  }

  async obter(id: number, usuario: UsuarioAutenticado) {
    await this.atualizarAtrasos();
    return this.detalhar(await this.autorizada(id, usuario), this.banco.manager);
  }

  /** Histórico de planos, do mais recente ao primeiro, com os nomes das referências e do autor. */
  async revisoes(id: number, usuario: UsuarioAutenticado) {
    await this.autorizada(id, usuario);
    const linhas: unknown[] = await this.banco.query(`SELECT r.id, r.versao_plano, r.tipo_operacao, r.contrato_id, ct.numero_contrato, r.imovel_id, i.titulo AS imovel_titulo,
        r.pessoa_id, p.nome AS pessoa_nome, r.valor_total, r.quantidade_parcelas, r.primeiro_vencimento::text AS primeiro_vencimento,
        r.autor_id, a.nome AS autor_nome, r.origem, r.criado_em
      FROM comissao_revisoes r
      LEFT JOIN contrato ct ON ct.id = r.contrato_id JOIN imoveis i ON i.id = r.imovel_id JOIN pessoas p ON p.id = r.pessoa_id
      LEFT JOIN corretores a ON a.id = r.autor_id
      WHERE r.comissao_id = $1 ORDER BY r.versao_plano DESC`, [id]);
    return { itens: linhas };
  }

  async alterar(id: number, dto: AlterarComissaoDto, usuario: UsuarioAutenticado) {
    return this.transacao(async gerenciador => {
      const comissao = await gerenciador.findOne(Comissao, { where: { id }, lock: BLOQUEIO });
      if (!comissao) throw new NotFoundException('Comissão não encontrada.');
      await this.referencias(comissao.imovel_id, comissao.pessoa_id, usuario, gerenciador);
      if (dto.versao_registro !== comissao.versao_registro) throw new ConflictException('Esta comissão foi alterada por outra pessoa ou por um recebimento. Recarregue a ficha e confira os dados antes de salvar.');

      const revisao = await gerenciador.findOneBy(RevisaoComissao, { comissao_id: id, versao_plano: comissao.versao_plano });
      if (!revisao) throw new ConflictException('Plano vigente sem revisão registrada.');
      const atual: Plano = { tipo_operacao: comissao.tipo_operacao, contrato_id: comissao.contrato_id, imovel_id: comissao.imovel_id, pessoa_id: comissao.pessoa_id, valor_total: comissao.valor_total, quantidade_parcelas: comissao.quantidade_parcelas, primeiro_vencimento: revisao.primeiro_vencimento };
      const alvo: Plano = { ...atual };
      for (const campo of CAMPOS_PLANO) if (dto[campo] !== undefined) Object.assign(alvo, { [campo]: dto[campo] });
      // Mudança efetiva: reenviar os valores atuais não conta.
      const mudaPlano = CAMPOS_PLANO.some(campo => alvo[campo] !== atual[campo]);
      const mudaObservacoes = dto.observacoes !== undefined && (dto.observacoes ?? null) !== comissao.observacoes;
      const mudaAtivo = dto.ativo !== undefined && dto.ativo !== comissao.ativo;

      if (mudaPlano) {
        if (!comissao.ativo || dto.ativo === false) throw new ConflictException('Comissão arquivada só permite observações e reativação. Reative antes de alterar valores ou vínculos.');
        const recebida = await gerenciador.exists(ParcelaComissao, { where: { comissao_id: id, status: 'PAGO' } });
        if (recebida) throw new ConflictException('Comissão com recebimento registrado não permite alterar valores, parcelas, vencimento ou vínculos. Só observações, arquivamento e reativação.');
        await this.validarVinculos(alvo, usuario, gerenciador, atual);
        await gerenciador.update(ParcelaComissao, { comissao_id: id, versao_plano: comissao.versao_plano }, { ativo: false, alterado_por: usuario.id });
        Object.assign(comissao, camposComissao(alvo), { versao_plano: comissao.versao_plano + 1 });
        await this.gerarPlano(gerenciador, comissao, alvo, usuario, 'EDICAO');
      }
      if (mudaAtivo) {
        if (dto.ativo) {
          try { await this.validarVinculos(atual, usuario, gerenciador); }
          catch (erro) {
            if (erro instanceof BadRequestException || erro instanceof NotFoundException) throw new ConflictException(`Não é possível reativar: ${erro.message}`);
            throw erro;
          }
        }
        // Planos substituídos continuam inativos; só o vigente acompanha a comissão.
        await gerenciador.update(ParcelaComissao, { comissao_id: id, versao_plano: comissao.versao_plano }, { ativo: dto.ativo, alterado_por: usuario.id });
        comissao.ativo = dto.ativo as boolean;
      }
      if (mudaObservacoes) comissao.observacoes = dto.observacoes ?? null;
      if (mudaPlano || mudaAtivo || mudaObservacoes) {
        comissao.versao_registro += 1;
        comissao.alterado_por = usuario.id;
        await gerenciador.save(comissao);
      }
      await this.atualizarAtrasos(gerenciador);
      return this.detalhar(comissao, gerenciador);
    });
  }

  async pagarParcela(id: number, dto: PagarParcelaDto, usuario: UsuarioAutenticado): Promise<ParcelaComissao> {
    if (dto.confirmar_pagamento !== true || dto.observacao_pagamento.trim().length < 5) throw new BadRequestException('Confirme o pagamento e informe a referência do comprovante.');
    return this.transacao(async gerenciador => {
      const parcela = await gerenciador.findOne(ParcelaComissao, { where: { id }, lock: BLOQUEIO });
      if (!parcela) throw new NotFoundException('Parcela não encontrada.');
      const comissao = await gerenciador.findOne(Comissao, { where: { id: parcela.comissao_id }, lock: BLOQUEIO });
      if (!comissao) throw new NotFoundException('Comissão não encontrada.');
      await this.referencias(comissao.imovel_id, comissao.pessoa_id, usuario, gerenciador, true);
      if (parcela.versao_plano !== comissao.versao_plano) throw new ConflictException('Esta parcela pertence a um plano substituído. Recarregue a comissão para ver as parcelas vigentes.');
      if (!parcela.ativo || !comissao.ativo) throw new ConflictException('Comissão desativada não permite baixa.');
      if (parcela.status === 'PAGO') {
        if (parcela.observacao_pagamento !== dto.observacao_pagamento.trim()) throw new ConflictException('Parcela já paga com outro comprovante.');
        return parcela;
      }
      parcela.status = 'PAGO'; parcela.pago_em = new Date(); parcela.observacao_pagamento = dto.observacao_pagamento.trim(); parcela.alterado_por = usuario.id;
      // Baixa efetiva também invalida edições abertas com a versão anterior.
      await gerenciador.update(Comissao, { id: comissao.id }, { versao_registro: comissao.versao_registro + 1, alterado_por: usuario.id });
      return gerenciador.save(parcela);
    });
  }
}
