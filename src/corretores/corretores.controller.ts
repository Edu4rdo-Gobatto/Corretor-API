import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import { Cargos, CargosGuard } from '../autenticacao/cargos.guard';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AtualizarCorretorDto, ConsultarCorretoresDto, CriarCorretorDto } from './corretores.dto';
import { CorretoresService } from './corretores.service';

@Controller('admin/corretores') @UseGuards(AutenticacaoGuard, CargosGuard) @Cargos('ADMIN')
export class CorretoresController {
  constructor(private readonly corretores: CorretoresService) {}
  @Get() listar(@Query() consulta: ConsultarCorretoresDto) { return this.corretores.listar(consulta); }
  @Get(':id') buscar(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.corretores.buscarPorId(id); }
  @Post() criar(@Body() dto: CriarCorretorDto, @Req() requisicao: { user: UsuarioAutenticado }) { return this.corretores.criar(dto, requisicao.user); }
  @Patch(':id') atualizar(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: AtualizarCorretorDto, @Req() requisicao: { user: UsuarioAutenticado }) { return this.corretores.atualizar(id, dto, requisicao.user); }
  @Delete(':id') desativar(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() requisicao: { user: UsuarioAutenticado }) { return this.corretores.desativar(id, requisicao.user); }
}
