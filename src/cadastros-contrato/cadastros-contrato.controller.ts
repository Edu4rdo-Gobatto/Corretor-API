import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import { Cargos, CargosGuard } from '../autenticacao/cargos.guard';
import { ConsultaCadastrosDto } from '../cadastros/cadastros.dto';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AtualizarIndiceReajusteDto, AtualizarTipoContratoDto, CriarIndiceReajusteDto, CriarTipoContratoDto } from './cadastros-contrato.dto';
import { CadastrosContratoService } from './cadastros-contrato.service';

type Requisicao = Request & { user: UsuarioAutenticado };

/** Opções ativas para o formulário de contrato (ADMIN e CORRETOR). Fora do catálogo público. */
@Controller('cadastros')
@UseGuards(AutenticacaoGuard)
export class OpcoesContratoController {
  constructor(private readonly cadastros: CadastrosContratoService) {}
  @Get('indices-reajuste') indices(@Query() consulta: ConsultaCadastrosDto) { return this.cadastros.listar('indices-reajuste', consulta, true); }
  @Get('tipos-contrato') tipos(@Query() consulta: ConsultaCadastrosDto) { return this.cadastros.listar('tipos-contrato', consulta, true); }
}

/** Desativação lógica via PATCH `{ativo:false}`; vínculos em contratos permanecem. */
@Controller('admin/indices-reajuste')
@UseGuards(AutenticacaoGuard, CargosGuard)
@Cargos('ADMIN')
export class IndicesReajusteController {
  constructor(private readonly cadastros: CadastrosContratoService) {}
  @Get() listar(@Query() consulta: ConsultaCadastrosDto) { return this.cadastros.listar('indices-reajuste', consulta); }
  @Get(':id') encontrar(@Param('id', ParseIntPipe) id: number) { return this.cadastros.encontrar('indices-reajuste', id); }
  @Post() criar(@Body() dto: CriarIndiceReajusteDto, @Req() requisicao: Requisicao) { return this.cadastros.criar('indices-reajuste', dto, requisicao.user); }
  @Patch(':id') atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarIndiceReajusteDto, @Req() requisicao: Requisicao) { return this.cadastros.atualizar('indices-reajuste', id, dto, requisicao.user); }
}

@Controller('admin/tipos-contrato')
@UseGuards(AutenticacaoGuard, CargosGuard)
@Cargos('ADMIN')
export class TiposContratoController {
  constructor(private readonly cadastros: CadastrosContratoService) {}
  @Get() listar(@Query() consulta: ConsultaCadastrosDto) { return this.cadastros.listar('tipos-contrato', consulta); }
  @Get(':id') encontrar(@Param('id', ParseIntPipe) id: number) { return this.cadastros.encontrar('tipos-contrato', id); }
  @Post() criar(@Body() dto: CriarTipoContratoDto, @Req() requisicao: Requisicao) { return this.cadastros.criar('tipos-contrato', dto, requisicao.user); }
  @Patch(':id') atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarTipoContratoDto, @Req() requisicao: Requisicao) { return this.cadastros.atualizar('tipos-contrato', id, dto, requisicao.user); }
}
