import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AlterarComissaoDto, ConsultaComissoesDto, CriarComissaoDto, PagarParcelaDto } from './comissoes.dto';
import { ComissoesService } from './comissoes.service';

type Requisicao = Request & { user: UsuarioAutenticado };
@Controller('admin/comissoes')
@UseGuards(AutenticacaoGuard)
export class ComissoesController {
  constructor(private readonly servico: ComissoesService) {}
  @Get() listar(@Query() consulta: ConsultaComissoesDto, @Req() requisicao: Requisicao) { return this.servico.listar(consulta, requisicao.user); }
  @Get(':id') obter(@Param('id', ParseUUIDPipe) id: string, @Req() requisicao: Requisicao) { return this.servico.obter(id, requisicao.user); }
  @Post() criar(@Body() dto: CriarComissaoDto, @Req() requisicao: Requisicao) { return this.servico.criar(dto, requisicao.user); }
  @Patch(':id') alterar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AlterarComissaoDto, @Req() requisicao: Requisicao) { return this.servico.alterar(id, dto, requisicao.user); }
  @Delete(':id') desativar(@Param('id', ParseUUIDPipe) id: string, @Req() requisicao: Requisicao) { return this.servico.alterar(id, { ativo: false }, requisicao.user); }
  @Patch('parcelas/:id/pagamento') pagar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PagarParcelaDto, @Req() requisicao: Requisicao) { return this.servico.pagarParcela(id, dto, requisicao.user); }
}
