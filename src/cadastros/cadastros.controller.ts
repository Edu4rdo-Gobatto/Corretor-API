import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AtualizarCadastroDto, AtualizarCaracteristicaDto, ConsultaCadastrosDto, CriarCadastroDto, CriarCaracteristicaDto } from './cadastros.dto';
import { CadastrosService, CategoriaCadastro } from './cadastros.service';

type Requisicao = Request & { user: UsuarioAutenticado };

function controladorPublico(categoria: CategoriaCadastro) {
  @Controller(categoria)
  class CadastroPublicoController {
    constructor(readonly cadastros: CadastrosService) {}
    @Get() listar(@Query() consulta: ConsultaCadastrosDto) { return this.cadastros.listar(categoria, consulta, true); }
  }
  return CadastroPublicoController;
}

function controladorAdministrativo(categoria: 'tipos-imovel' | 'finalidades-imovel') {
  @Controller(`admin/${categoria}`)
  @UseGuards(AutenticacaoGuard)
  class CadastroAdministrativoController {
    constructor(readonly cadastros: CadastrosService) {}
    @Get() listar(@Query() consulta: ConsultaCadastrosDto) { return this.cadastros.listar(categoria, consulta); }
    @Get(':id') encontrar(@Param('id', ParseUUIDPipe) id: string) { return this.cadastros.encontrar(categoria, id); }
    @Post() criar(@Body() dto: CriarCadastroDto, @Req() requisicao: Requisicao) { return this.cadastros.criar(categoria, dto, requisicao.user); }
    @Patch(':id') atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarCadastroDto, @Req() requisicao: Requisicao) { return this.cadastros.atualizar(categoria, id, dto, requisicao.user); }
    @Delete(':id') @HttpCode(204) async desativar(@Param('id', ParseUUIDPipe) id: string, @Req() requisicao: Requisicao) { await this.cadastros.atualizar(categoria, id, { ativo: false }, requisicao.user); }
  }
  return CadastroAdministrativoController;
}

@Controller('admin/caracteristicas')
@UseGuards(AutenticacaoGuard)
export class CaracteristicasController {
  constructor(private readonly cadastros: CadastrosService) {}
  @Get() listar(@Query() consulta: ConsultaCadastrosDto) { return this.cadastros.listar('caracteristicas', consulta); }
  @Get(':id') encontrar(@Param('id', ParseUUIDPipe) id: string) { return this.cadastros.encontrar('caracteristicas', id); }
  @Post() criar(@Body() dto: CriarCaracteristicaDto, @Req() requisicao: Requisicao) { return this.cadastros.criar('caracteristicas', dto, requisicao.user); }
  @Patch(':id') atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarCaracteristicaDto, @Req() requisicao: Requisicao) { return this.cadastros.atualizar('caracteristicas', id, dto, requisicao.user); }
  @Delete(':id') @HttpCode(204) async desativar(@Param('id', ParseUUIDPipe) id: string, @Req() requisicao: Requisicao) { await this.cadastros.atualizar('caracteristicas', id, { ativo: false }, requisicao.user); }
}

export const controladoresCadastros = [
  controladorPublico('tipos-imovel'), controladorPublico('finalidades-imovel'), controladorPublico('caracteristicas'),
  controladorAdministrativo('tipos-imovel'), controladorAdministrativo('finalidades-imovel'), CaracteristicasController,
];
