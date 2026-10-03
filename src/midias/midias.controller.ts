import { Body, Controller, Delete, HttpCode, Param, ParseIntPipe, Patch, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { CriarVideoEmbedDto, ReordenarMidiasDto } from './midias.dto';
import { MidiasService } from './midias.service';
import { ArquivoMidia, TAMANHO_MAXIMO_VIDEO } from './validacao-arquivo';

import { PodeEditarImovelGuard } from './pode-editar-imovel.guard';
import { ArmazenamentoLimitado, RecepcaoMidiasInterceptor } from './recepcao-midias';

type Requisicao = Request & { user: UsuarioAutenticado };

@Controller('admin/imoveis/:imovel_id/midias')
@UseGuards(AutenticacaoGuard, PodeEditarImovelGuard)
export class MidiasController {
  constructor(private readonly midias: MidiasService) {}
  @Post()
  // Busboy sinaliza partsLimit ao atingir o teto: a parte sentinela mantém 20 arquivos válidos.
  @UseInterceptors(RecepcaoMidiasInterceptor, FilesInterceptor('arquivos', 20, { storage: new ArmazenamentoLimitado(), limits: { fileSize: TAMANHO_MAXIMO_VIDEO, files: 20, fields: 0, parts: 21, headerPairs: 100 } }))
  enviar(@Param('imovel_id', ParseIntPipe) imovel_id: number, @UploadedFiles() arquivos: ArquivoMidia[], @Req() requisicao: Requisicao) {
    return this.midias.enviar(imovel_id, arquivos, requisicao.user);
  }
  @Post('video-embed') adicionar_embed(@Param('imovel_id', ParseIntPipe) imovel_id: number, @Body() dto: CriarVideoEmbedDto, @Req() requisicao: Requisicao) { return this.midias.adicionar_embed(imovel_id, dto, requisicao.user); }
  @Patch('ordem') reordenar(@Param('imovel_id', ParseIntPipe) imovel_id: number, @Body() dto: ReordenarMidiasDto, @Req() requisicao: Requisicao) { return this.midias.reordenar(imovel_id, dto, requisicao.user); }
  @Patch(':midia_id/capa') definir_capa(@Param('imovel_id', ParseIntPipe) imovel_id: number, @Param('midia_id', ParseIntPipe) midia_id: number, @Req() requisicao: Requisicao) { return this.midias.definir_capa(imovel_id, midia_id, requisicao.user); }
  @Delete(':midia_id') @HttpCode(204) excluir(@Param('imovel_id', ParseIntPipe) imovel_id: number, @Param('midia_id', ParseIntPipe) midia_id: number, @Req() requisicao: Requisicao) { return this.midias.excluir(imovel_id, midia_id, requisicao.user); }
}
