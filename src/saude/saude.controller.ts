import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('saude')
export class SaudeController {
  constructor(@InjectDataSource() private readonly banco: DataSource) {}
  @Get()
  async verificar() {
    try { await this.banco.query('SELECT 1'); return { status: 'ok', verificado_em: new Date().toISOString() }; }
    catch { throw new ServiceUnavailableException('Banco temporariamente indisponível.'); }
  }
}
