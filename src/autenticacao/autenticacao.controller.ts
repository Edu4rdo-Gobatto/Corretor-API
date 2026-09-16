import { Body, Controller, Get, Header, HttpCode, HttpStatus, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AlterarSenhaDto, AtualizarPerfilDto } from '../corretores/corretores.dto';
import { CorretoresService } from '../corretores/corretores.service';
import { EntrarDto } from './autenticacao.dto';
import { AutenticacaoGuard } from './autenticacao.guard';
import { AutenticacaoService } from './autenticacao.service';
import { OrigemGuard } from './origem.guard';
import { DURACAO_SESSAO_MS } from './sessoes.service';
import { TentativasGuard } from './tentativas.guard';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

@Controller('autenticacao')
export class AutenticacaoController {
  constructor(private readonly autenticacao: AutenticacaoService, private readonly corretores: CorretoresService) {}

  @Post('entrar') @HttpCode(HttpStatus.OK) @Header('Cache-Control', 'no-store') @UseGuards(OrigemGuard, TentativasGuard)
  async entrar(@Body() dto: EntrarDto, @Res({ passthrough: true }) resposta: Response) {
    return this.definirSessao(await this.autenticacao.entrar(dto), resposta);
  }

  @Post('renovar') @HttpCode(HttpStatus.OK) @Header('Cache-Control', 'no-store') @UseGuards(OrigemGuard)
  async renovar(@Req() requisicao: Request, @Res({ passthrough: true }) resposta: Response) {
    return this.definirSessao(await this.autenticacao.renovar(this.lerCookie(requisicao)), resposta);
  }

  @Post('sair') @HttpCode(HttpStatus.NO_CONTENT) @Header('Cache-Control', 'no-store') @UseGuards(OrigemGuard)
  async sair(@Req() requisicao: Request, @Res({ passthrough: true }) resposta: Response) {
    await this.autenticacao.sair(this.lerCookie(requisicao));
    resposta.clearCookie('corretor_renovacao', this.opcoesCookie());
  }

  @Get('eu') @Header('Cache-Control', 'no-store') @UseGuards(AutenticacaoGuard)
  eu(@Req() requisicao: RequisicaoAutenticada) { return this.corretores.buscarPorId(requisicao.user.id); }

  @Patch('eu') @Header('Cache-Control', 'no-store') @UseGuards(AutenticacaoGuard, OrigemGuard)
  atualizarPerfil(@Req() requisicao: RequisicaoAutenticada, @Body() dto: AtualizarPerfilDto) { return this.corretores.atualizarPerfil(requisicao.user.id, dto); }

  @Patch('eu/senha') @Header('Cache-Control', 'no-store') @UseGuards(AutenticacaoGuard, OrigemGuard)
  alterarSenha(@Req() requisicao: RequisicaoAutenticada, @Body() dto: AlterarSenhaDto) { return this.autenticacao.alterarSenha(requisicao.user.id, dto); }

  private lerCookie(requisicao: Request): string {
    const prefixo = 'corretor_renovacao=';
    return requisicao.headers.cookie?.split(';').map(parte => parte.trim()).find(parte => parte.startsWith(prefixo))?.slice(prefixo.length) ?? '';
  }
  private opcoesCookie() { return { httpOnly: true, sameSite: 'strict' as const, secure: true, path: '/' }; }
  private definirSessao(sessao: Awaited<ReturnType<AutenticacaoService['entrar']>>, resposta: Response) {
    const { token_renovacao, ...dados } = sessao;
    resposta.cookie('corretor_renovacao', token_renovacao, { ...this.opcoesCookie(), maxAge: DURACAO_SESSAO_MS });
    return dados;
  }
}
