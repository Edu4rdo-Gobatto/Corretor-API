import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AtualizarClienteDto, ClienteManualDto, ClientePublicoDto, ConsultaClientesDto } from './clientes.dto';
import { ClientesService } from './clientes.service';
import { LimiteClientesGuard } from './limite-clientes.guard';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

@Controller('clientes')
export class ClientesPublicosController {
  constructor(private readonly clientes: ClientesService) {}
  @Post() @Header('Cache-Control', 'no-store') @UseGuards(LimiteClientesGuard)
  criar(@Body() dto: ClientePublicoDto, @Req() requisicao: Request) {
    return this.clientes.criarPublico(dto, requisicao.ip || '');
  }
}

@Controller('admin/clientes')
@UseGuards(AutenticacaoGuard)
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}
  @Get() @Header('Cache-Control', 'private, no-store')
  listar(@Query() consulta: ConsultaClientesDto, @Req() requisicao: RequisicaoAutenticada) {
    return this.clientes.listar(consulta, requisicao.user);
  }
  @Get(':id') @Header('Cache-Control', 'private, no-store')
  obter(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() requisicao: RequisicaoAutenticada) {
    return this.clientes.obter(id, requisicao.user);
  }
  @Post() @Header('Cache-Control', 'private, no-store')
  criar(@Body() dto: ClienteManualDto, @Req() requisicao: RequisicaoAutenticada) {
    return this.clientes.criarManual(dto, requisicao.user);
  }
  @Patch(':id') @Header('Cache-Control', 'private, no-store')
  atualizar(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: AtualizarClienteDto, @Req() requisicao: RequisicaoAutenticada) {
    return this.clientes.atualizar(id, dto, requisicao.user);
  }
  @Delete(':id') @Header('Cache-Control', 'private, no-store')
  desativar(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() requisicao: RequisicaoAutenticada) {
    return this.clientes.atualizar(id, { ativo: false }, requisicao.user);
  }
}
