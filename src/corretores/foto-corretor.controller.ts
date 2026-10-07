import { Controller, Get, NotFoundException, Param, ParseIntPipe, Res, ServiceUnavailableException } from '@nestjs/common';
import { Response } from 'express';
import { CorretoresService } from './corretores.service';
import { FotosCorretorService } from './fotos-corretor.service';

/** Foto pública já exposta no catálogo; não recebe URL, caminho ou chave de storage do visitante. */
@Controller('corretores')
export class FotoCorretorController {
  constructor(private readonly corretores: CorretoresService, private readonly fotos: FotosCorretorService) {}

  @Get(':id/foto')
  async foto(@Param('id', ParseIntPipe) id: number, @Res() resposta: Response) {
    const corretor = await this.corretores.buscarAtivoPorId(id);
    if (!corretor?.url_foto) throw new NotFoundException('Foto não encontrada.');
    resposta.setHeader('Cache-Control', 'no-cache');
    resposta.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (!this.fotos.chave(corretor.url_foto, id)) {
      let url: URL;
      try { url = new URL(corretor.url_foto); } catch { throw new NotFoundException('Foto não encontrada.'); }
      if (url.protocol !== 'https:') throw new NotFoundException('Foto não encontrada.');
      resposta.redirect(302, url.href); return;
    }
    try {
      const objeto = await this.fotos.ler(corretor.url_foto, id);
      if (!objeto?.Body) throw new NotFoundException('Foto não encontrada.');
      const tipos = ['image/jpeg', 'image/png', 'image/webp'];
      if (!objeto.ContentType || !tipos.includes(objeto.ContentType)) throw new NotFoundException('Foto não encontrada.');
      resposta.setHeader('Content-Type', objeto.ContentType);
      resposta.setHeader('Content-Disposition', 'inline');
      resposta.setHeader('X-Content-Type-Options', 'nosniff');
      resposta.send(Buffer.from(await objeto.Body.transformToByteArray()));
    } catch (erro) {
      if (erro instanceof NotFoundException || (erro instanceof Error && erro.name === 'NoSuchKey')) throw new NotFoundException('Foto não encontrada.');
      throw new ServiceUnavailableException('Não foi possível carregar a foto. Tente novamente.');
    }
  }
}
