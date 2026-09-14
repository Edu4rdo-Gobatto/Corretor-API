import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { EntityManager, Repository } from 'typeorm';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { Imovel } from '../imoveis/imovel.entity';
import { ImovelMidia, TipoMidia } from './imovel-midia.entity';
import { MidiasService } from './midias.service';
import { normalizar_video_embed } from './video-embed';

describe('Mídias: transações, autorização e compensação R2', () => {
  const usuario: UsuarioAutenticado = { id: 'responsavel', nome: 'Responsável', email: 'teste@example.test', cargo: 'CORRETOR' };
  const imovel = Object.assign(new Imovel(), { id: 'imovel', corretor_id: usuario.id });
  const jpeg = Buffer.from([255, 216, 255, 224, 0, 0]);
  const arquivo = { buffer: jpeg, size: jpeg.length, mimetype: 'image/jpeg' };
  let registros: ImovelMidia[];
  let falha_save: boolean;
  let falha_commit: boolean;
  let sequencia: number;
  const armazenamento = { send: jest.fn<Promise<unknown>, [unknown]>() };
  const consulta = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn() };
  const imoveis = { findOne: jest.fn() };
  const repositorio = {
    find: jest.fn(() => Promise.resolve([...registros].sort((a, b) => a.ordem - b.ordem))),
    findOneBy: jest.fn(({ id }: { id: string }) => Promise.resolve(registros.find((item) => item.id === id) ?? null)),
    create: (dados: Partial<ImovelMidia>) => Object.assign(new ImovelMidia(), { id: `midia-${++sequencia}` }, dados),
    save: jest.fn((dados: ImovelMidia | ImovelMidia[]) => {
      if (falha_save) return Promise.reject(new Error('falha banco'));
      const itens = Array.isArray(dados) ? dados : [dados];
      for (const item of itens) { const indice = registros.findIndex((existente) => existente.id === item.id); if (indice < 0) registros.push(item); else registros[indice] = item; }
      return Promise.resolve(dados);
    }),
    remove: jest.fn((item: ImovelMidia) => { registros = registros.filter((existente) => existente.id !== item.id); return Promise.resolve(item); }),
    update: jest.fn((_condicao: unknown, dados: Partial<ImovelMidia>) => { registros.forEach((item) => Object.assign(item, dados)); return Promise.resolve({ affected: registros.length }); }),
    createQueryBuilder: () => consulta,
    manager: { transaction: async <T>(executar: (gerenciador: EntityManager) => Promise<T>) => {
      const copia = registros.map((item) => Object.assign(new ImovelMidia(), item));
      try {
        const resultado = await executar({ getRepository: (entidade: unknown) => entidade === Imovel ? imoveis : repositorio } as unknown as EntityManager);
        if (falha_commit) throw new Error('falha commit');
        return resultado;
      } catch (erro) { registros = copia; throw erro; }
    } },
  };
  const servico = new MidiasService(repositorio as unknown as Repository<ImovelMidia>, armazenamento as unknown as S3Client, new ConfigService({ R2_PUBLIC_URL: 'https://midias.example.test' }));

  beforeEach(() => {
    registros = []; falha_save = false; falha_commit = false; sequencia = 0;
    imoveis.findOne.mockResolvedValue(imovel);
    consulta.getOne.mockImplementation(() => Promise.resolve(registros[0] ?? null));
    armazenamento.send.mockImplementation((comando) => Promise.resolve(comando instanceof GetObjectCommand ? { Body: { transformToByteArray: () => Promise.resolve(jpeg) }, ContentType: 'image/jpeg', ContentLength: jpeg.length } : {}));
  });

  it('valida todo o lote antes de enviar e proíbe MIME falsificado', async () => {
    await expect(servico.enviar(imovel.id, [arquivo, { ...arquivo, buffer: Buffer.from('malicioso'), size: 9 }], usuario)).rejects.toThrow('assinatura');
    expect(armazenamento.send).not.toHaveBeenCalled();
  });

  it('impede alteração por outro corretor antes de escrever no R2', async () => {
    await expect(servico.enviar(imovel.id, [arquivo], { ...usuario, id: 'outro' })).rejects.toThrow('responsável');
    expect(armazenamento.send).not.toHaveBeenCalled();
  });

  it('primeira foto vira capa mesmo após vídeo e nunca retorna chave de armazenamento', async () => {
    registros.push(repositorio.create({ tipo: TipoMidia.VIDEO_EMBED, ordem: 0, capa: false }));
    const resultado = await servico.enviar(imovel.id, [arquivo, arquivo], usuario);
    expect(resultado.map((item) => [item.ordem, item.capa])).toEqual([[1, true], [2, false]]);
    expect(JSON.stringify(resultado)).not.toContain('chave_armazenamento');
    expect(imoveis.findOne).toHaveBeenCalledWith({ where: { id: imovel.id }, lock: { mode: 'pessimistic_write' } });
  });

  it('compensa todos os objetos e preserva DB quando commit falha', async () => {
    falha_commit = true;
    await expect(servico.enviar(imovel.id, [arquivo, arquivo], usuario)).rejects.toThrow('falha commit');
    expect(armazenamento.send.mock.calls.filter(([comando]) => comando instanceof DeleteObjectCommand)).toHaveLength(2);
    expect(registros).toHaveLength(0);
  });

  it('compensa upload cujo resultado pode ter sido perdido por timeout', async () => {
    armazenamento.send.mockImplementation((comando) => comando instanceof PutObjectCommand ? Promise.reject(new Error('timeout')) : Promise.resolve({}));
    await expect(servico.enviar(imovel.id, [arquivo], usuario)).rejects.toThrow('timeout');
    expect(armazenamento.send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('normaliza YouTube/Vimeo e rejeita origem enganosa, credenciais e vídeo inválido', () => {
    expect(normalizar_video_embed('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(normalizar_video_embed('https://vimeo.com/1234')).toBe('https://player.vimeo.com/video/1234');
    for (const valor of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://user@youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/no', 'http://vimeo.com/1234']) expect(normalizar_video_embed(valor)).toBeNull();
  });

  it('reordenação rejeita subconjunto/IDs repetidos e aceita lista integral', async () => {
    registros = [repositorio.create({ ordem: 0 }), repositorio.create({ ordem: 1 })];
    const ids = registros.map((item) => item.id);
    await expect(servico.reordenar(imovel.id, { midias_ids: [ids[0], ids[0]] }, usuario)).rejects.toThrow('uma única vez');
    await expect(servico.reordenar(imovel.id, { midias_ids: [ids[0]] }, usuario)).rejects.toThrow('todas');
    expect((await servico.reordenar(imovel.id, { midias_ids: ids.reverse() }, usuario)).map((item) => item.ordem)).toEqual([0, 1]);
  });

  it('impede capa em vídeo e mantém exatamente uma capa entre imagens', async () => {
    const video = repositorio.create({ tipo: TipoMidia.VIDEO_EMBED, capa: false });
    const foto = repositorio.create({ tipo: TipoMidia.IMAGEM, capa: true });
    const foto2 = repositorio.create({ tipo: TipoMidia.IMAGEM, capa: false });
    registros = [video, foto, foto2];
    await expect(servico.definir_capa(imovel.id, video.id, usuario)).rejects.toThrow('imagem');
    await servico.definir_capa(imovel.id, foto2.id, usuario);
    expect(registros.filter((item) => item.capa).map((item) => item.id)).toEqual([foto2.id]);
  });

  it('exclusão de capa escolhe primeira foto restante e compacta ordem', async () => {
    registros = [repositorio.create({ tipo: TipoMidia.IMAGEM, capa: true, ordem: 0, chave_armazenamento: 'chave' }), repositorio.create({ tipo: TipoMidia.VIDEO_EMBED, capa: false, ordem: 1 }), repositorio.create({ tipo: TipoMidia.IMAGEM, capa: false, ordem: 2 })];
    await servico.excluir(imovel.id, registros[0].id, usuario);
    expect(registros.map((item) => [item.tipo, item.capa, item.ordem])).toEqual([['VIDEO_EMBED', false, 0], ['IMAGEM', true, 1]]);
    expect(armazenamento.send.mock.calls.map(([comando]) => (comando as object).constructor.name)).toEqual(['GetObjectCommand', 'DeleteObjectCommand']);
  });

  it('restaura arquivo e DB se exclusão falha no commit', async () => {
    registros = [repositorio.create({ tipo: TipoMidia.IMAGEM, capa: true, ordem: 0, chave_armazenamento: 'chave' })];
    falha_commit = true;
    await expect(servico.excluir(imovel.id, registros[0].id, usuario)).rejects.toThrow('falha commit');
    expect(registros).toHaveLength(1);
    const restauracao = armazenamento.send.mock.calls[2][0];
    expect(restauracao).toBeInstanceOf(PutObjectCommand);
    expect((restauracao as PutObjectCommand).input).toMatchObject({ Key: 'chave', Body: jpeg, ContentType: 'image/jpeg' });
  });

  it('falha no R2 impede remoção do registro', async () => {
    registros = [repositorio.create({ tipo: TipoMidia.IMAGEM, capa: true, ordem: 0, chave_armazenamento: 'chave' })];
    armazenamento.send.mockRejectedValue(new Error('R2 indisponível'));
    await expect(servico.excluir(imovel.id, registros[0].id, usuario)).rejects.toThrow('R2 indisponível');
    expect(repositorio.remove).not.toHaveBeenCalled();
    expect(registros).toHaveLength(1);
  });
});
