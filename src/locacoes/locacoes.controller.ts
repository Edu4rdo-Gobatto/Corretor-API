import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AlterarContratoDto, ConsultaContratosDto, CriarContratoDto } from './locacoes.dto';
import { LocacoesService } from './locacoes.service';

type Requisicao = Request & { user: UsuarioAutenticado };

@Controller('admin/contratos')
@UseGuards(AutenticacaoGuard)
export class ContratosController {
  constructor(private readonly servico: LocacoesService) {}
  @Get() listar(@Query() consulta: ConsultaContratosDto, @Req() requisicao: Requisicao) { return this.servico.listarContratos(consulta, requisicao.user); }
  @Get(':id') obter(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { return this.servico.obterContrato(id, requisicao.user); }
  @Post() criar(@Body() dto: CriarContratoDto, @Req() requisicao: Requisicao) { return this.servico.criarContrato(dto, requisicao.user); }
  @Patch(':id') alterar(@Param('id', ParseIntPipe) id: number, @Body() dto: AlterarContratoDto, @Req() requisicao: Requisicao) { return this.servico.alterarContrato(id, dto, requisicao.user); }
  @Delete(':id') @HttpCode(204) async desativar(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { await this.servico.alterarContrato(id, { ativo: false }, requisicao.user); }
  @Post(':id/pasta-drive') repetirPasta(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { return this.servico.repetirPasta(id, requisicao.user); }
}
