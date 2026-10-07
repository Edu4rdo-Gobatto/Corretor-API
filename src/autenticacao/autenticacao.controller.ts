import { Body, Controller, Get, Header, HttpCode, HttpStatus, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ArmazenamentoLimitado, RecepcaoMidiasInterceptor } from '../midias/recepcao-midias';
import { ArquivoMidia, TAMANHO_MAXIMO_IMAGEM } from '../midias/validacao-arquivo';
import { Request, Response } from 'express';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AlterarSenhaDto, AtualizarPerfilDto } from '../corretores/corretores.dto';
import { CorretoresService } from '../corretores/corretores.service';
import { EntrarDto } from './autenticacao.dto';
import { AutenticacaoGuard } from './autenticacao.guard';
import { AutenticacaoService } from './autenticacao.service';
import { OrigemGuard } from './origem.guard';
import { COOKIE_SESSAO, lerCookieSessao, opcoesCookieSessao } from './cookie-sessao';
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
    return this.definirSessao(await this.autenticacao.renovar(lerCookieSessao(requisicao)), resposta);
  }

  @Post('sair') @HttpCode(HttpStatus.NO_CONTENT) @Header('Cache-Control', 'no-store') @UseGuards(OrigemGuard)
  async sair(@Req() requisicao: Request, @Res({ passthrough: true }) resposta: Response) {
    await this.autenticacao.sair(lerCookieSessao(requisicao));
    resposta.clearCookie(COOKIE_SESSAO, opcoesCookieSessao());
  }

  @Get('eu') @Header('Cache-Control', 'no-store') @UseGuards(AutenticacaoGuard)
  eu(@Req() requisicao: RequisicaoAutenticada) { return this.corretores.buscarPorId(requisicao.user.id); }

  @Patch('eu') @Header('Cache-Control', 'no-store') @UseGuards(AutenticacaoGuard, OrigemGuard)
  @UseInterceptors(RecepcaoMidiasInterceptor, FileInterceptor('foto', { storage: new ArmazenamentoLimitado(TAMANHO_MAXIMO_IMAGEM), limits: { fileSize: TAMANHO_MAXIMO_IMAGEM, files: 1, fields: 4, fieldSize: 2048, parts: 6, headerPairs: 100 } }))
  atualizarPerfil(@Req() requisicao: RequisicaoAutenticada, @Body() dto: AtualizarPerfilDto, @UploadedFile() foto?: ArquivoMidia) { return this.corretores.atualizarPerfil(requisicao.user.id, dto, foto); }

  @Patch('eu/senha') @Header('Cache-Control', 'no-store') @UseGuards(AutenticacaoGuard, OrigemGuard)
  alterarSenha(@Req() requisicao: RequisicaoAutenticada, @Body() dto: AlterarSenhaDto) { return this.autenticacao.alterarSenha(requisicao.user.id, dto); }

  private definirSessao(sessao: Awaited<ReturnType<AutenticacaoService['entrar']>>, resposta: Response) {
    const { token_renovacao, ...dados } = sessao;
    resposta.cookie(COOKIE_SESSAO, token_renovacao, opcoesCookieSessao());
    return dados;
  }
}
