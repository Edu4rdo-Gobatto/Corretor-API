import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Imovel } from '../imoveis/imovel.entity';
import { PodeEditarImovelGuard } from './pode-editar-imovel.guard';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';

describe('PodeEditarImovelGuard', () => {
  const corretor: UsuarioAutenticado = { id: 10, nome: 'Corretor', email: 'c@example.test', cargo: 'CORRETOR' };
  const admin: UsuarioAutenticado = { id: 1, nome: 'Admin', email: 'a@example.test', cargo: 'ADMIN' };
  const imovel = Object.assign(new Imovel(), { id: 5, corretor_id: 10 });

  function criarContexto(params: Record<string, string>, user?: UsuarioAutenticado): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ params, user }),
      }),
    } as unknown as ExecutionContext;
  }

  function criarGuard(imovelEncontrado: Imovel | null = imovel) {
    const repositorio = {
      findOneBy: jest.fn().mockResolvedValue(imovelEncontrado),
    } as unknown as Repository<Imovel>;
    return { guard: new PodeEditarImovelGuard(repositorio), repositorio };
  }

  it('rejeita id de imóvel inválido com 404', async () => {
    const { guard } = criarGuard();
    await expect(guard.canActivate(criarContexto({ imovel_id: 'abc' }, corretor))).rejects.toBeInstanceOf(NotFoundException);
    await expect(guard.canActivate(criarContexto({ imovel_id: '-1' }, corretor))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita imóvel inexistente com 404', async () => {
    const { guard } = criarGuard(null);
    await expect(guard.canActivate(criarContexto({ imovel_id: '99' }, corretor))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita requisição sem usuário autenticado com 403', async () => {
    const { guard } = criarGuard();
    await expect(guard.canActivate(criarContexto({ imovel_id: '5' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejeita corretor que não é o responsável pelo imóvel com 403 antes do buffering', async () => {
    const { guard } = criarGuard();
    const outroCorretor: UsuarioAutenticado = { ...corretor, id: 99 };
    await expect(guard.canActivate(criarContexto({ imovel_id: '5' }, outroCorretor))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite o corretor responsável pelo imóvel', async () => {
    const { guard } = criarGuard();
    await expect(guard.canActivate(criarContexto({ imovel_id: '5' }, corretor))).resolves.toBe(true);
  });

  it('permite administrador mesmo não sendo o responsável', async () => {
    const { guard } = criarGuard();
    await expect(guard.canActivate(criarContexto({ imovel_id: '5' }, admin))).resolves.toBe(true);
  });
});

