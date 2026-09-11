import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}
  @Get()
  async check() {
    try { await this.dataSource.query('SELECT 1'); return { status: 'ok', timestamp: new Date().toISOString() }; }
    catch { throw new HttpException({ status: 'error' }, HttpStatus.SERVICE_UNAVAILABLE); }
  }
}
