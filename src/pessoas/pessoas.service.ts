import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel, StatusImovel } from '../imoveis/imovel.entity';
import { Contrato } from '../locacoes/contrato.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { dataCivilValida, documentoValido, escaparBusca } from '../comum/validacao';
import { hojeCivil } from '../comum/datas';
import { OrigemPessoa, Pessoa, StatusContato, resposta_pessoa } from './pessoa.entity';
import { AtualizarPessoaDto, ConsultaPessoasDto, CriarPessoaDto, PessoaPublicaDto } from './pessoas.dto';

const VINCULADA_A_CONTRATO_DO_USUARIO = 'EXISTS (SELECT 1 FROM contrato c WHERE c.corretor_id = :usuario AND (c.locador_id = pessoa.id OR c.locatario_id = pessoa.id))';

@Injectable()
export class PessoasService {
  constructor(@InjectRepository(Pessoa) private readonly pessoas: Repository<Pessoa>, private readonly banco: DataSource) {}

  async criarPublico(dto: PessoaPublicaDto, ip: string): Promise<{ id: number }> {
    if (dto.consentimento !== true) throw new BadRequestException('O consentimento é obrigatório.');
    return this.banco.transaction(async gerenciador => {
      const imovel = await gerenciador.getRepository(Imovel).findOne({
        where: { id: dto.imovel_id, ativo: true, status: StatusImovel.DISPONIVEL, corretor: { ativo: true } }, relations: { corretor: true },
      });
      if (!imovel) throw new BadRequestException('Imóvel indisponível para atendimento.');
      const repositorio = gerenciador.getRepository(Pessoa);
      const pessoa = await repositorio.save(repositorio.create({
        nome: dto.nome, telefone: dto.telefone, email: dto.email ?? null, mensagem: dto.mensagem ?? null,
        imovel_id: imovel.id, corretor_id: imovel.corretor_id, origem: OrigemPessoa.SITE, status_contato: StatusContato.PENDENTE,
        consentimento: true, consentimento_ip: ip || null, consentimento_em: new Date(), versao_termos: 'v1.0',
        ativo: true, criado_por: null, alterado_por: null,
      }));
      return { id: pessoa.id };
    });
  }

  async criarManual(dto: CriarPessoaDto, usuario: UsuarioAutenticado) {
    const corretor_id = dto.corretor_id ?? usuario.id;
    this.validarAtribuicao(corretor_id, usuario);
    return this.banco.transaction(async gerenciador => {
      await this.validarVinculos(gerenciador, corretor_id, dto.imovel_id);
      const repositorio = gerenciador.getRepository(Pessoa);
      const pessoa = repositorio.create({
        ...this.camposCadastro(dto), nome: dto.nome, telefone: dto.telefone, corretor_id, origem: OrigemPessoa.MANUAL,
        status_contato: dto.status_contato ?? StatusContato.RESPONDIDO,
        consentimento: false, consentimento_em: null, consentimento_ip: null, versao_termos: null,
        ativo: true, criado_por: usuario.id, alterado_por: usuario.id,
      });
      this.validarDocumento(pessoa);
      return resposta_pessoa(await repositorio.save(pessoa));
    });
  }

  async listar(consulta: ConsultaPessoasDto, usuario: UsuarioAutenticado) {
    if (consulta.criado_desde && consulta.criado_ate && new Date(consulta.criado_desde) > new Date(consulta.criado_ate)) throw new BadRequestException('O início deve ser anterior ao fim.');
    const busca = this.visiveis(usuario);
    if (consulta.id) busca.andWhere('pessoa.id = :id', { id: consulta.id });
    if (consulta.status_contato) busca.andWhere('pessoa.status_contato = :status', { status: consulta.status_contato });
    if (consulta.imovel_id) busca.andWhere('pessoa.imovel_id = :imovel', { imovel: consulta.imovel_id });
    if (consulta.corretor_id) busca.andWhere('pessoa.corretor_id = :corretor', { corretor: consulta.corretor_id });
    if (consulta.ativo !== undefined) busca.andWhere('pessoa.ativo = :ativo', { ativo: consulta.ativo });
    if (consulta.criado_desde) busca.andWhere('pessoa.criado_em >= :desde', { desde: new Date(consulta.criado_desde) });
    if (consulta.criado_ate) busca.andWhere('pessoa.criado_em <= :ate', { ate: new Date(consulta.criado_ate) });
    if (consulta.busca) {
      const termo = `%${escaparBusca(consulta.busca)}%`;
      const digitos = consulta.busca.replace(/\D/g, '');
      busca.andWhere('(pessoa.nome ILIKE :termo OR pessoa.email ILIKE :termo' + (digitos ? ' OR pessoa.telefone LIKE :digitos OR pessoa.cpf_cnpj LIKE :digitos' : '') + ')', { termo, digitos: `%${digitos}%` });
    }
    const [itens, total] = await busca.orderBy('pessoa.criado_em', 'DESC').addOrderBy('pessoa.id', 'DESC')
      .skip((consulta.pagina - 1) * consulta.limite).take(consulta.limite).getManyAndCount();
    return { itens: itens.map(resposta_pessoa), total, pagina: consulta.pagina, limite: consulta.limite, total_paginas: Math.ceil(total / consulta.limite) };
  }

  async obter(id: number, usuario: UsuarioAutenticado) {
    const pessoa = await this.visiveis(usuario).andWhere('pessoa.id = :id', { id }).getOne();
    if (!pessoa) throw new NotFoundException('Pessoa não encontrada.');
    return resposta_pessoa(pessoa);
  }

  async atualizar(id: number, dto: AtualizarPessoaDto, usuario: UsuarioAutenticado) {
    if (dto.corretor_id !== undefined) this.validarAtribuicao(dto.corretor_id, usuario);
    return this.banco.transaction(async gerenciador => {
      const repositorio = gerenciador.getRepository(Pessoa);
      const pessoa = await repositorio.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!pessoa || !this.podeEditar(pessoa, usuario)) throw new NotFoundException('Pessoa não encontrada.');
      if (dto.corretor_id !== undefined || dto.imovel_id !== undefined) await this.validarVinculos(gerenciador, dto.corretor_id ?? pessoa.corretor_id, dto.imovel_id);
      if (dto.ativo === false && pessoa.ativo && await gerenciador.count(Contrato, { where: [{ locador_id: id, status: 'ATIVO' }, { locatario_id: id, status: 'ATIVO' }] })) {
        throw new ConflictException('Pessoa vinculada a contrato ativo não pode ser desativada.');
      }
      Object.assign(pessoa, Object.fromEntries(Object.entries(dto).filter(([, valor]) => valor !== undefined)), { alterado_por: usuario.id });
      this.validarDocumento(pessoa);
      return resposta_pessoa(await repositorio.save(pessoa));
    });
  }

  async desativar(id: number, usuario: UsuarioAutenticado): Promise<void> { await this.atualizar(id, { ativo: false }, usuario); }

  /** ADMIN vê todas; corretor vê as suas e as que participam de contratos que intermedeia. */
  private visiveis(usuario: UsuarioAutenticado): SelectQueryBuilder<Pessoa> {
    const busca = this.pessoas.createQueryBuilder('pessoa');
    if (usuario.cargo !== 'ADMIN') busca.andWhere(`(pessoa.corretor_id = :usuario OR ${VINCULADA_A_CONTRATO_DO_USUARIO})`, { usuario: usuario.id });
    return busca;
  }

  private podeEditar(pessoa: Pessoa, usuario: UsuarioAutenticado): boolean {
    return usuario.cargo === 'ADMIN' || pessoa.corretor_id === usuario.id;
  }

  private camposCadastro(dto: CriarPessoaDto) {
    return {
      email: dto.email ?? null, mensagem: dto.mensagem ?? null, tipo_pessoa: dto.tipo_pessoa ?? null, cpf_cnpj: dto.cpf_cnpj ?? null,
      data_nascimento: dto.data_nascimento ?? null, endereco: dto.endereco ?? null, banco_nome: dto.banco_nome ?? null,
      banco_agencia: dto.banco_agencia ?? null, banco_conta: dto.banco_conta ?? null, chave_pix: dto.chave_pix ?? null,
      observacoes: dto.observacoes ?? null, imovel_id: dto.imovel_id ?? null,
    };
  }

  private validarDocumento(pessoa: Pick<Pessoa, 'tipo_pessoa' | 'cpf_cnpj' | 'data_nascimento'>): void {
    if (pessoa.cpf_cnpj) {
      if (!documentoValido(pessoa.cpf_cnpj)) throw new BadRequestException('CPF/CNPJ inválido.');
      const tipo = pessoa.cpf_cnpj.length === 11 ? 'PF' : 'PJ';
      if (pessoa.tipo_pessoa && pessoa.tipo_pessoa !== tipo) throw new BadRequestException('CPF/CNPJ incompatível com o tipo de pessoa.');
      pessoa.tipo_pessoa = tipo;
    }
    if (pessoa.data_nascimento && (pessoa.tipo_pessoa === 'PJ' || !dataCivilValida(pessoa.data_nascimento) || pessoa.data_nascimento > hojeCivil())) {
      throw new BadRequestException('Data de nascimento inválida para a pessoa.');
    }
  }

  private validarAtribuicao(id: number, usuario: UsuarioAutenticado): void {
    if (usuario.cargo !== 'ADMIN' && id !== usuario.id) throw new ForbiddenException('Somente ADMIN pode atribuir outro responsável.');
  }

  private async validarVinculos(gerenciador: EntityManager, corretor_id: number, imovel_id?: number | null): Promise<void> {
    if (!await gerenciador.getRepository(Corretor).findOne({ where: { id: corretor_id, ativo: true } })) throw new BadRequestException('Corretor inativo ou inexistente.');
    if (imovel_id && !await gerenciador.getRepository(Imovel).findOne({ where: { id: imovel_id, ativo: true } })) throw new BadRequestException('Imóvel inativo ou inexistente.');
  }
}
