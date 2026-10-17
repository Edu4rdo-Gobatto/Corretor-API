import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ArmazenamentoLimitado, RecepcaoMidiasInterceptor } from '../midias/recepcao-midias';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { AlterarContratoDto, ConsultaContratosDto, CriarContratoDto, EncerrarContratoDto, RenovarContratoDto } from './locacoes.dto';
import { LocacoesService } from './locacoes.service';

const TAMANHO_MAXIMO_DOCUMENTOS = 30 * 1024 * 1024;
type Requisicao =Request & { user: UsuarioAutenticado };

@Controller('admin/contratos')
@UseGuards(AutenticacaoGuard)
export class ContratosController {
  constructor(private readonly servico: LocacoesService) {}
  @Get() listar(@Query() consulta: ConsultaContratosDto, @Req() requisicao: Requisicao) { return this.servico.listarContratos(consulta, requisicao.user); }
  @Get(':id') obter(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { return this.servico.obterContrato(id, requisicao.user); }
  @Post() criar(@Body() dto: CriarContratoDto, @Req() requisicao: Requisicao) { return this.servico.criarContrato(dto, requisicao.user); }
  @Patch(':id') alterar(@Param('id', ParseIntPipe) id: number, @Body() dto: AlterarContratoDto, @Req() requisicao: Requisicao) { return this.servico.alterarContrato(id, dto, requisicao.user); }
  @Delete(':id') @HttpCode(204) async desativar(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { await this.servico.alterarContrato(id, { ativo: false }, requisicao.user); }
  @Post(':id/encerrar') @HttpCode(200) encerrar(@Param('id', ParseIntPipe) id: number, @Body() dto: EncerrarContratoDto, @Req() requisicao: Requisicao) { return this.servico.encerrarContrato(id, dto, requisicao.user); }
  @Post(':id/renovar') renovar(@Param('id', ParseIntPipe) id: number, @Body() dto: RenovarContratoDto, @Req() requisicao: Requisicao) { return this.servico.renovarContrato(id, dto, requisicao.user); }
  @Get(':id/documentos') listarDocumentos(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { return this.servico.listarDocumentos(id, requisicao.user); }
  @Post(':id/documentos') @UseInterceptors(RecepcaoMidiasInterceptor, FilesInterceptor('arquivos', 10, { storage: new ArmazenamentoLimitado(TAMANHO_MAXIMO_DOCUMENTOS), limits: { fileSize: TAMANHO_MAXIMO_DOCUMENTOS, files: 10, fields: 0, parts: 11, headerPairs: 100 } }))
  enviarDocumentos(@Param('id', ParseIntPipe) id: number, @UploadedFiles() arquivos: { originalname: string; mimetype: string; buffer: Buffer }[] | undefined, @Req() requisicao: Requisicao) { return this.servico.enviarDocumentos(id, arquivos ?? [], requisicao.user); }
  @Post(':id/pasta-drive') repetirPasta(@Param('id', ParseIntPipe) id: number, @Req() requisicao: Requisicao) { return this.servico.repetirPasta(id, requisicao.user); }
}
