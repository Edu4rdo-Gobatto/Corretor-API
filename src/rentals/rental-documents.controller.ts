import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AgentRole } from '../agents/agent.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RentalDocumentsService } from './rental-documents.service';
import { DocumentTargetDto } from './rental.dto';
import { DocumentUpload, MAX_DOCUMENT_SIZE } from './rental-rules';
import { RentalPrivacyInterceptor } from './rental-privacy.interceptor';
@Controller('admin/rental-documents')
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(AgentRole.ADMIN) @UseInterceptors(RentalPrivacyInterceptor)
export class RentalDocumentsController {
  constructor(private readonly documents: RentalDocumentsService) {}
  @Get() list(@Query() query: DocumentTargetDto) { return this.documents.list(query); }
  @Post() @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1, fields: 2, parts: 3 } }))
  upload(@Body() dto: DocumentTargetDto, @UploadedFile() file?: DocumentUpload) { return this.documents.upload(dto, file); }
  @Get(':id/download') async download(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const { document, bytes } = await this.documents.download(id);
    return new StreamableFile(bytes, { type: document.contentType, length: bytes.length,
      disposition: `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(document.fileName).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16)}`)}` });
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.documents.remove(id); }
}
