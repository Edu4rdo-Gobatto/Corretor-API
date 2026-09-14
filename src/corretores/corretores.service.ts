import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, QueryFailedError, Repository } from 'typeorm';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { escaparBusca } from '../comum/validacao';
import { CargoCorretor, Corretor, perfilCorretor } from './corretor.entity';
import { AlterarSenhaDto, AtualizarCorretorDto, AtualizarPerfilDto, ConsultarCorretoresDto, CriarCorretorDto } from './corretores.dto';
import { SenhasService } from './senhas.service';

@Injectable()
export class CorretoresService {
  constructor(@InjectRepository(Corretor) private readonly corretores: Repository<Corretor>, private readonly senhas: SenhasService) {}

  buscarParaAutenticacao(email: string): Promise<Corretor | null> {
    return this.corretores.findOne({ where: { email: email.trim().toLowerCase() }, select: this.camposComSenha() });
  }

  buscarAtivoPorId(id: string): Promise<Corretor | null> { return this.corretores.findOneBy({ id, ativo: true }); }

  async buscarPorId(id: string) {
    const corretor = await this.corretores.findOneBy({ id });
    if (!corretor) throw new NotFoundException('Corretor não encontrado.');
    return perfilCorretor(corretor);
  }

  async listar(consulta: ConsultarCorretoresDto) {
    const [itens, total] = await this.corretores.findAndCount({
      where: { ...(consulta.busca ? { nome: ILike(`%${escaparBusca(consulta.busca)}%`) } : {}), ...(consulta.ativo === undefined ? {} : { ativo: consulta.ativo }) },
      order: { nome: 'ASC', id: 'ASC' }, skip: (consulta.pagina - 1) * consulta.limite, take: consulta.limite,
    });
    return { itens: itens.map(perfilCorretor), total, pagina: consulta.pagina, limite: consulta.limite, total_paginas: Math.ceil(total / consulta.limite) };
  }

  async criar(dto: CriarCorretorDto, usuario: UsuarioAutenticado) {
    return this.salvarNovo(this.corretores, dto, await this.senhas.gerarHash(dto.senha), usuario.id);
  }

  async criarAdministradorInicial(dto: CriarCorretorDto) {
    const senha_hash = await this.senhas.gerarHash(dto.senha);
    return this.corretores.manager.transaction(async gerente => {
      await gerente.query('SELECT pg_advisory_xact_lock(741901)');
      const repositorio = gerente.getRepository(Corretor);
      if (await repositorio.existsBy({ cargo: CargoCorretor.ADMIN })) throw new ConflictException('Já existe um administrador. Use o cadastro autenticado.');
      return this.salvarNovo(repositorio, { ...dto, cargo: CargoCorretor.ADMIN }, senha_hash, null);
    });
  }

  async atualizar(id: string, dto: AtualizarCorretorDto, usuario: UsuarioAutenticado) {
    const senha_hash = dto.senha === undefined ? undefined : await this.senhas.gerarHash(dto.senha);
    return this.corretores.manager.transaction(async gerente => {
      // A trava antecede a leitura e a contagem para serializar rebaixamentos entre instâncias.
      await gerente.query('SELECT pg_advisory_xact_lock(741901)');
      const repositorio = gerente.getRepository(Corretor);
      const corretor = await repositorio.findOneBy({ id });
      if (!corretor) throw new NotFoundException('Corretor não encontrado.');
      const remove_admin = corretor.ativo && corretor.cargo === CargoCorretor.ADMIN
        && (dto.ativo === false || (dto.cargo !== undefined && dto.cargo !== CargoCorretor.ADMIN));
      if (remove_admin && await repositorio.countBy({ ativo: true, cargo: CargoCorretor.ADMIN }) <= 1) {
        throw new ConflictException('Não é possível desativar ou rebaixar o último administrador ativo.');
      }
      const campos = ['nome', 'email', 'cpf', 'whatsapp', 'creci', 'cargo', 'url_foto', 'ativo'] as const;
      const alteracoes = Object.fromEntries(campos.filter(campo => dto[campo] !== undefined).map(campo => [campo, dto[campo]]));
      Object.assign(corretor, alteracoes, senha_hash === undefined ? {} : { senha_hash }, { alterado_por: usuario.id });
      return this.salvar(repositorio, corretor);
    });
  }

  desativar(id: string, usuario: UsuarioAutenticado) { return this.atualizar(id, { ativo: false }, usuario); }

  async atualizarPerfil(id: string, dto: AtualizarPerfilDto) {
    const corretor = await this.buscarAtivoPorId(id);
    if (!corretor) throw new UnauthorizedException('Sessão inválida.');
    return this.atualizar(id, { nome: dto.nome, whatsapp: dto.whatsapp, creci: dto.creci, url_foto: dto.url_foto }, corretor);
  }

  async alterarSenha(id: string, dto: AlterarSenhaDto) {
    return this.corretores.manager.transaction(async gerente => {
      await gerente.query('SELECT pg_advisory_xact_lock(741901)');
      const repositorio = gerente.getRepository(Corretor);
      const corretor = await repositorio.findOne({ where: { id, ativo: true }, select: this.camposComSenha() });
      if (!corretor || !await this.senhas.verificar(corretor.senha_hash, dto.senha_atual)) throw new UnauthorizedException('Senha atual incorreta.');
      corretor.senha_hash = await this.senhas.gerarHash(dto.nova_senha);
      corretor.alterado_por = id;
      return this.salvar(repositorio, corretor);
    });
  }

  private async salvarNovo(repositorio: Repository<Corretor>, dto: CriarCorretorDto, senha_hash: string, autor: string | null) {
    const email = dto.email.trim().toLowerCase();
    if (await repositorio.existsBy({ email })) throw new ConflictException('Já existe um corretor com esse e-mail.');
    return this.salvar(repositorio, repositorio.create({
      nome: dto.nome, email, senha_hash, cpf: dto.cpf, whatsapp: dto.whatsapp,
      creci: dto.creci ?? null, cargo: dto.cargo, url_foto: dto.url_foto ?? null, ativo: true, criado_por: autor, alterado_por: autor,
    }));
  }

  private async salvar(repositorio: Repository<Corretor>, corretor: Corretor) {
    try { return perfilCorretor(await repositorio.save(corretor)); }
    catch (erro) {
      if (erro instanceof QueryFailedError) {
        const causa: unknown = erro.driverError;
        if (typeof causa === 'object' && causa !== null && 'code' in causa && causa.code === '23505') throw new ConflictException('Já existe um corretor com esse e-mail.');
      }
      throw erro;
    }
  }

  private camposComSenha(): (keyof Corretor)[] {
    return ['id', 'nome', 'email', 'senha_hash', 'cpf', 'whatsapp', 'creci', 'cargo', 'url_foto', 'ativo', 'criado_em', 'alterado_em', 'criado_por', 'alterado_por'];
  }
}
