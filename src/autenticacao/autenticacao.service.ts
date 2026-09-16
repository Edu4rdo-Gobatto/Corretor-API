import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { Corretor, perfilCorretor } from '../corretores/corretor.entity';
import { CorretoresService } from '../corretores/corretores.service';
import { SenhasService } from '../corretores/senhas.service';
import { EntrarDto } from './autenticacao.dto';
import { SessoesService } from './sessoes.service';
import { AlterarSenhaDto } from '../corretores/corretores.dto';

@Injectable()
export class AutenticacaoService {
  private hash_disfarce?: Promise<string>;
  constructor(private readonly corretores: CorretoresService, private readonly senhas: SenhasService, private readonly jwt: JwtService, private readonly sessoes: SessoesService) {}

  async entrar(dto: EntrarDto) {
    const corretor = await this.corretores.buscarParaAutenticacao(dto.email);
    const hash_disfarce = await (this.hash_disfarce ??= this.senhas.gerarHash(randomBytes(32).toString('base64url')));
    const senha_valida = await this.senhas.verificar(corretor?.senha_hash ?? hash_disfarce, dto.senha);
    if (!corretor || !corretor.ativo || !senha_valida) throw new UnauthorizedException('E-mail ou senha inválidos.');
    return this.emitirSessao(corretor);
  }

  async renovar(token: string) {
    const corretor = await this.corretores.buscarAtivoPorId(await this.sessoes.consumir(token));
    if (!corretor) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    return this.emitirSessao(corretor);
  }

  sair(token: string): Promise<void> { return this.sessoes.revogar(token); }

  async alterarSenha(id: number, dto: AlterarSenhaDto) {
    const perfil = await this.corretores.alterarSenha(id, dto);
    await this.sessoes.revogarTodasDoCorretor(id);
    return perfil;
  }

  private async emitirSessao(corretor: Corretor) {
    const token_acesso = await this.jwt.signAsync({ sub: String(corretor.id), cargo: corretor.cargo });
    const token_renovacao = await this.sessoes.criar(corretor.id);
    return { token_acesso, token_renovacao, tipo_token: 'Bearer' as const, corretor: perfilCorretor(corretor) };
  }
}
