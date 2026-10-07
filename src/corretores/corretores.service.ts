import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { FotosCorretorService } from './fotos-corretor.service';
import { ArquivoMidia } from '../midias/validacao-arquivo';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, QueryFailedError, Repository } from 'typeorm';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { escaparBusca } from '../comum/validacao';
import { CargoCorretor, Corretor, perfilCorretor } from './corretor.entity';
import { AlterarSenhaDto, AtualizarCorretorDto, AtualizarPerfilDto, ConsultarCorretoresDto, CriarCorretorDto } from './corretores.dto';
import { SenhasService } from './senhas.service';
import { SessaoLogin } from '../autenticacao/sessao-login.entity';

@Injectable()
export class CorretoresService {
  // O CLI de bootstrap pode criar contas sem instanciar o adaptador de fotos.
  constructor(@InjectRepository(Corretor) private readonly corretores: Repository<Corretor>, private readonly senhas: SenhasService, private readonly fotos?: FotosCorretorService) {}

  buscarParaAutenticacao(email: string): Promise<Corretor | null> {
    return this.corretores.findOne({ where: { email: email.trim().toLowerCase() }, select: this.camposComSenha() });
  }

  buscarAtivoPorId(id: number): Promise<Corretor | null> { return this.corretores.findOneBy({ id, ativo: true }); }

  async buscarPorId(id: number) {
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

  async atualizar(id: number, dto: AtualizarCorretorDto, usuario: UsuarioAutenticado, fotoEnviada = false) {
    const senha_hash = dto.senha === undefined ? undefined : await this.senhas.gerarHash(dto.senha);
    let fotoAnterior: string | null = null;
    const salvo = await this.corretores.manager.transaction(async gerente => {
      // A trava antecede a leitura e a contagem para serializar rebaixamentos entre instâncias.
      await gerente.query('SELECT pg_advisory_xact_lock(741901)');
      const repositorio = gerente.getRepository(Corretor);
      const corretor = await repositorio.findOneBy({ id });
      if (!corretor) throw new NotFoundException('Corretor não encontrado.');
      if (!fotoEnviada && dto.url_foto !== corretor.url_foto && this.fotos?.chave(dto.url_foto, id)) {
        throw new ConflictException('A foto foi atualizada. Atualize o perfil ou envie a imagem novamente.');
      }
      const remove_admin = corretor.ativo && corretor.cargo === CargoCorretor.ADMIN
        && (dto.ativo === false || (dto.cargo !== undefined && dto.cargo !== CargoCorretor.ADMIN));
      if (remove_admin && await repositorio.countBy({ ativo: true, cargo: CargoCorretor.ADMIN }) <= 1) {
        throw new ConflictException('Não é possível desativar ou rebaixar o último administrador ativo.');
      }
      const campos = ['nome', 'email', 'cpf', 'whatsapp', 'creci', 'cargo', 'url_foto', 'ativo'] as const;
      if (dto.url_foto !== undefined && dto.url_foto !== corretor.url_foto) fotoAnterior = corretor.url_foto;
      const alteracoes = Object.fromEntries(campos.filter(campo => dto[campo] !== undefined).map(campo => [campo, dto[campo]]));
      Object.assign(corretor, alteracoes, senha_hash === undefined ? {} : { senha_hash }, { alterado_por: usuario.id });
      // GAP-03: revogar sessões quando ADMIN redefine senha ou desativa corretor.
      if (senha_hash !== undefined || dto.ativo === false) {
        await gerente.createQueryBuilder()
          .delete()
          .from(SessaoLogin)
          .where('corretor_id = :id', { id })
          .execute();
      }
      return this.salvar(repositorio, corretor);
    });
    await this.fotos?.excluir(fotoAnterior, id);
    return salvo;
  }

  desativar(id: number, usuario: UsuarioAutenticado) { return this.atualizar(id, { ativo: false }, usuario); }

  async atualizarPerfil(id: number, dto: AtualizarPerfilDto, foto?: ArquivoMidia) {
    const corretor = await this.buscarAtivoPorId(id);
    if (!corretor) throw new UnauthorizedException('Sessão inválida.');
    if (foto && dto.url_foto !== undefined) throw new BadRequestException('Envie uma foto ou uma URL, nunca as duas opções juntas.');
    if (foto && !this.fotos) throw new ServiceUnavailableException('O serviço de fotos está indisponível.');
    const url = foto ? await this.fotos!.enviar(id, foto) : undefined;
    try { return await this.atualizar(id, { nome: dto.nome, whatsapp: dto.whatsapp, creci: dto.creci === '' ? null : dto.creci, url_foto: url ?? dto.url_foto }, corretor, Boolean(url)); }
    catch (erro) { if (url) await this.fotos?.excluir(url, id); throw erro; }
  }

  async alterarSenha(id: number, dto: AlterarSenhaDto) {
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

  private async salvarNovo(repositorio: Repository<Corretor>, dto: CriarCorretorDto, senha_hash: string, autor: number | null) {
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
