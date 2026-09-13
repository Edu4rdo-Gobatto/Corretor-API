import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    const payload = exception instanceof HttpException ? exception.getResponse() : 'Erro interno do servidor.';
    const message = typeof payload === 'string' ? payload : 'message' in payload ? payload.message : 'Não foi possível concluir a solicitação.';
    response.status(status).json({ statusCode: status, message });
  }
}
