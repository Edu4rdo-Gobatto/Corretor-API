import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AgentProfile } from '../agents/dto/agent-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMediaEmbedDto } from './dto/create-media-embed.dto';
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { MediaService } from './media.service';

type AuthenticatedRequest = Request & { user: AgentProfile };
type UploadedMediaFile = { buffer: Buffer; mimetype: string; size: number };

@Controller('properties/:propertyId/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly medias: MediaService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 30 * 1024 * 1024 } }))
  upload(@Param('propertyId', new ParseUUIDPipe({ version: '4' })) propertyId: string,
    @UploadedFiles() files: UploadedMediaFile[], @Req() request: AuthenticatedRequest) {
    return this.medias.upload(propertyId, files, request.user);
  }

  @Post('embed')
  addEmbed(@Param('propertyId', new ParseUUIDPipe({ version: '4' })) propertyId: string,
    @Body() dto: CreateMediaEmbedDto, @Req() request: AuthenticatedRequest) {
    return this.medias.addEmbed(propertyId, dto, request.user);
  }

  @Patch('reorder')
  reorder(@Param('propertyId', new ParseUUIDPipe({ version: '4' })) propertyId: string,
    @Body() dto: ReorderMediaDto, @Req() request: AuthenticatedRequest) {
    return this.medias.reorder(propertyId, dto, request.user);
  }

  @Patch(':mediaId/cover')
  setCover(@Param('propertyId', new ParseUUIDPipe({ version: '4' })) propertyId: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string, @Req() request: AuthenticatedRequest) {
    return this.medias.setCover(propertyId, mediaId, request.user);
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('propertyId', new ParseUUIDPipe({ version: '4' })) propertyId: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string, @Req() request: AuthenticatedRequest) {
    return this.medias.remove(propertyId, mediaId, request.user);
  }
}
