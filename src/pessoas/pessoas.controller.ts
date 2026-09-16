import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AtualizarPessoaDto, ConsultaPessoasDto, CriarPessoaDto, PessoaPublicaDto } from './pessoas.dto';
import { PessoasService } from './pessoas.service';
import { LimitePessoasGuard } from './limite-pessoas.guard';

type Requisicao = Request & { user: UsuarioAutenticado };

@Controller('pessoas')
export class PessoasPublicasController {
  constructor(private readonly pessoas: PessoasService) {}
  @Post() @Header('Cache-Control', 'no-store') @UseGuards(LimitePessoasGuard)
  criar(@Body() dto: PessoaPublicaDto, @Req() requisicao: Request) { return this.pessoas.criarPublico(dto, requisicao.ip || ''); }
}

@Controller('admin/pessoas')
@UseGuards(AutenticacaoGuard)
export class PessoasController {
  constructor(private readonly pessoas: PessoasService) {}
  @Get() @Header('Cache-Control', 'private, no-store')
  listar(@Query() consulta: ConsultaPessoasDto, @Req() requisicao: Requisicao) { return this.pessoas.listar(consulta, requisicao.user); }
  @Get(':id') @Header('Cache-Control', 'private, no-store')
  obter(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { return this.pessoas.obter(id, requisicao.user); }
  @Post() @Header('Cache-Control', 'private, no-store')
  criar(@Body() dto: CriarPessoaDto, @Req() requisicao: Requisicao) { return this.pessoas.criarManual(dto, requisicao.user); }
  @Patch(':id') @Header('Cache-Control', 'private, no-store')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarPessoaDto, @Req() requisicao: Requisicao) { return this.pessoas.atualizar(id, dto, requisicao.user); }
  @Delete(':id') @HttpCode(204) @Header('Cache-Control', 'private, no-store')
  desativar(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { return this.pessoas.desativar(id, requisicao.user); }
}
