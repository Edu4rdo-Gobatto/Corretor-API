import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AtualizarImovelDto, ConsultaImoveisDto, ConsultaInternaImoveisDto, CriarImovelDto } from './imoveis.dto';
import { ImoveisService } from './imoveis.service';

type Requisicao = Request & { user: UsuarioAutenticado };

@Controller('imoveis')
export class ImoveisPublicosController {
  constructor(private readonly imoveis: ImoveisService) {}
  @Get() listar(@Query() consulta: ConsultaImoveisDto) { return this.imoveis.listar_publicos(consulta); }
  @Get(':slug') encontrar(@Param('slug') slug: string) { return this.imoveis.encontrar_publico(slug); }
}

@Controller('admin/imoveis')
@UseGuards(AutenticacaoGuard)
export class ImoveisController {
  constructor(private readonly imoveis: ImoveisService) {}
  @Get() listar(@Query() consulta: ConsultaInternaImoveisDto) { return this.imoveis.listar_internos(consulta); }
  @Get(':id') encontrar(@Param('id', ParseIntPipe) id: number) { return this.imoveis.encontrar_interno(id); }
  @Post() criar(@Body() dto: CriarImovelDto, @Req() requisicao: Requisicao) { return this.imoveis.criar(dto, requisicao.user); }
  @Patch(':id') atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarImovelDto, @Req() requisicao: Requisicao) { return this.imoveis.atualizar(id, dto, requisicao.user); }
  @Delete(':id') @HttpCode(204) desativar(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { return this.imoveis.desativar(id, requisicao.user); }
}
