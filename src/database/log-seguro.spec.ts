import { LoggerSeguro, mensagemFalhaOperacional } from './log-seguro';

describe('logs de operações com dados pessoais', () => {
  it('não revela consulta, parâmetros ou detalhes PostgreSQL mesmo com logging habilitado', () => {
    const saida = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const erro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = new LoggerSeguro();
    logger.logQuery('INSERT INTO clientes VALUES ($1)', ['DADO-PESSOAL']);
    logger.logQueryError('Falha na linha DADO-PESSOAL', 'SELECT privado', ['DADO-PESSOAL']);
    expect(saida).not.toHaveBeenCalled();
    expect(erro).not.toHaveBeenCalled();
    expect(mensagemFalhaOperacional({ code: '23514', detail: 'DADO-PESSOAL', parameters: ['DADO-PESSOAL'] })).toBe('Falha na operação do banco (23514). Nenhum detalhe de dados foi registrado.');
    expect(mensagemFalhaOperacional(new Error('segredo-pessoal'))).not.toContain('segredo-pessoal');
    saida.mockRestore(); erro.mockRestore();
  });
});
