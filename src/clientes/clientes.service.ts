import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, ILike, Between, MoreThanOrEqual, LessThanOrEqual, Repository } from 'typeorm';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { escaparBusca } from '../comum/validacao';
import { Cliente, OrigemCliente } from './cliente.entity';
import { AtualizarClienteDto, ClienteManualDto, ClientePublicoDto, ConsultaClientesDto } from './clientes.dto';

@Injectable()
export class ClientesService {
  constructor(@InjectRepository(Cliente) private readonly clientes: Repository<Cliente>, private readonly banco: DataSource) {}

  async criarPublico(dto: ClientePublicoDto, ip: string): Promise<{ id: string }> {
    if (dto.consentimento !== true) throw new BadRequestException('O consentimento é obrigatório.');
    return this.banco.transaction(async gerenciador => {
      const imovel = await gerenciador.getRepository(Imovel).findOne({
        where: { id: dto.imovel_id, ativo: true, status: 'DISPONIVEL' as Imovel['status'], corretor: { ativo: true } },
        relations: { corretor: true },
      });
      if (!imovel) throw new BadRequestException('Imóvel indisponível para atendimento.');
      const repositorio = gerenciador.getRepository(Cliente);
      const cliente = await repositorio.save(repositorio.create({
        nome: dto.nome, telefone: dto.telefone, email: dto.email ?? null, mensagem: dto.mensagem ?? null,
        imovel_id: imovel.id, corretor_id: imovel.corretor_id, origem: OrigemCliente.SITE,
        consentimento: true, consentimento_ip: ip || null, consentimento_em: new Date(), versao_termos: 'v1.0',
        ativo: true, criado_por: null, alterado_por: null,
      }));
      return { id: cliente.id };
    });
  }

  async criarManual(dto: ClienteManualDto, usuario: UsuarioAutenticado): Promise<Cliente> {
    const corretor_id = dto.corretor_id ?? usuario.id;
    this.validarAtribuicao(corretor_id, usuario);
    return this.banco.transaction(async gerenciador => {
      await this.validarVinculos(gerenciador, corretor_id, dto.imovel_id);
      const repositorio = gerenciador.getRepository(Cliente);
      return repositorio.save(repositorio.create({
        nome: dto.nome, telefone: dto.telefone, email: dto.email ?? null, mensagem: dto.mensagem ?? null,
        imovel_id: dto.imovel_id ?? null, corretor_id, origem: OrigemCliente.MANUAL,
        consentimento: false, consentimento_em: null, consentimento_ip: null, versao_termos: null,
        ativo: true, criado_por: usuario.id, alterado_por: usuario.id,
      }));
    });
  }

  async listar(consulta: ConsultaClientesDto, usuario: UsuarioAutenticado) {
    const where: FindOptionsWhere<Cliente> = usuario.cargo === 'ADMIN' ? {} : { corretor_id: usuario.id };
    if (consulta.criado_desde && consulta.criado_ate && new Date(consulta.criado_desde) > new Date(consulta.criado_ate)) throw new BadRequestException('O início deve ser anterior ao fim.');
    if (consulta.criado_desde && consulta.criado_ate) where.criado_em = Between(new Date(consulta.criado_desde), new Date(consulta.criado_ate));
    else if (consulta.criado_desde) where.criado_em = MoreThanOrEqual(new Date(consulta.criado_desde));
    else if (consulta.criado_ate) where.criado_em = LessThanOrEqual(new Date(consulta.criado_ate));
    if (consulta.imovel_id) where.imovel_id = consulta.imovel_id;
    if (consulta.ativo !== undefined) where.ativo = consulta.ativo === 'true';
    if (consulta.busca) where.nome = ILike(`%${escaparBusca(consulta.busca)}%`);
    const [itens, total] = await this.clientes.findAndCount({
      where, order: { criado_em: 'DESC', id: 'DESC' }, take: consulta.limite, skip: (consulta.pagina - 1) * consulta.limite,
    });
    return { itens, total, pagina: consulta.pagina, limite: consulta.limite, total_paginas: Math.ceil(total / consulta.limite) };
  }

  async obter(id: string, usuario: UsuarioAutenticado): Promise<Cliente> {
    const cliente = await this.clientes.findOne({ where: this.restricao(id, usuario) });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    return cliente;
  }

  async atualizar(id: string, dto: AtualizarClienteDto, usuario: UsuarioAutenticado): Promise<Cliente> {
    if (dto.corretor_id !== undefined) this.validarAtribuicao(dto.corretor_id, usuario);
    return this.banco.transaction(async gerenciador => {
      const repositorio = gerenciador.getRepository(Cliente);
      const cliente = await repositorio.findOne({ where: this.restricao(id, usuario), lock: { mode: 'pessimistic_write' } });
      if (!cliente) throw new NotFoundException('Cliente não encontrado.');
      if (dto.corretor_id !== undefined || dto.imovel_id !== undefined) {
        await this.validarVinculos(gerenciador, dto.corretor_id ?? cliente.corretor_id, dto.imovel_id);
      }
      for (const chave of ['nome', 'telefone', 'email', 'mensagem', 'imovel_id', 'corretor_id', 'ativo'] as const) {
        const valor = dto[chave];
        if (valor !== undefined) Object.assign(cliente, { [chave]: valor });
      }
      cliente.alterado_por = usuario.id;
      return repositorio.save(cliente);
    });
  }

  private restricao(id: string, usuario: UsuarioAutenticado): FindOptionsWhere<Cliente> {
    return usuario.cargo === 'ADMIN' ? { id } : { id, corretor_id: usuario.id };
  }

  private validarAtribuicao(id: string, usuario: UsuarioAutenticado): void {
    if (usuario.cargo !== 'ADMIN' && id !== usuario.id) throw new ForbiddenException('Somente ADMIN pode atribuir outro atendente.');
  }

  private async validarVinculos(gerenciador: EntityManager, corretor_id: string, imovel_id?: string | null): Promise<void> {
    if (!await gerenciador.getRepository(Corretor).findOne({ where: { id: corretor_id, ativo: true } })) {
      throw new BadRequestException('Corretor inativo ou inexistente.');
    }
    if (imovel_id && !await gerenciador.getRepository(Imovel).findOne({ where: { id: imovel_id, ativo: true } })) {
      throw new BadRequestException('Imóvel inativo ou inexistente.');
    }
  }
}
