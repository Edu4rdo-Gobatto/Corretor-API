import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import { Cargos, CargosGuard } from '../autenticacao/cargos.guard';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AlterarContratoDto, AlterarParteLocacaoDto, ConsultaContratosDto, ConsultaPartesDto, CriarContratoDto, CriarParteLocacaoDto } from './locacoes.dto';
import { LocacoesService } from './locacoes.service';

type Requisicao = Request & { user: UsuarioAutenticado };
@Controller('admin/partes-locacao')
@UseGuards(AutenticacaoGuard, CargosGuard)
export class PartesLocacaoController {
  constructor(private readonly servico: LocacoesService) {}
  @Get() listar(@Query() consulta: ConsultaPartesDto, @Req() requisicao: Requisicao) { return this.servico.listarPartes(consulta, requisicao.user); }
  @Get(':id') obter(@Param('id', ParseUUIDPipe) id: string, @Req() requisicao: Requisicao) { return this.servico.obterParte(id, requisicao.user); }
  @Post() @Cargos('ADMIN') criar(@Body() dto: CriarParteLocacaoDto, @Req() requisicao: Requisicao) { return this.servico.criarParte(dto, requisicao.user); }
  @Patch(':id') @Cargos('ADMIN') alterar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AlterarParteLocacaoDto, @Req() requisicao: Requisicao) { return this.servico.alterarParte(id, dto, requisicao.user); }
  @Delete(':id') @Cargos('ADMIN') desativar(@Param('id', ParseUUIDPipe) id: string, @Req() requisicao: Requisicao) { return this.servico.alterarParte(id, { ativo: false }, requisicao.user); }
}

@Controller('admin/contratos')
@UseGuards(AutenticacaoGuard)
export class ContratosController {
  constructor(private readonly servico: LocacoesService) {}
  @Get() listar(@Query() consulta: ConsultaContratosDto, @Req() requisicao: Requisicao) { return this.servico.listarContratos(consulta, requisicao.user); }
  @Get(':id') obter(@Param('id', ParseUUIDPipe) id: string, @Req() requisicao: Requisicao) { return this.servico.obterContrato(id, requisicao.user); }
  @Post() criar(@Body() dto: CriarContratoDto, @Req() requisicao: Requisicao) { return this.servico.criarContrato(dto, requisicao.user); }
  @Patch(':id') alterar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AlterarContratoDto, @Req() requisicao: Requisicao) { return this.servico.alterarContrato(id, dto, requisicao.user); }
  @Delete(':id') desativar(@Param('id', ParseUUIDPipe) id: string, @Req() requisicao: Requisicao) { return this.servico.alterarContrato(id, { ativo: false }, requisicao.user); }
  @Post(':id/pasta-drive') repetirPasta(@Param('id', ParseUUIDPipe) id: string, @Req() requisicao: Requisicao) { return this.servico.repetirPasta(id, requisicao.user); }
}
