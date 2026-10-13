import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

/** Identificador inteiro positivo, aceito como número no corpo ou como texto na query. */
export const IdRegistro = (): PropertyDecorator => applyDecorators(Type(() => Number), IsInt(), Min(1));

const listaIds = ({ value }: { value: unknown }): unknown => value === undefined || value === null ? value
  : (Array.isArray(value) ? value as unknown[] : [value]).flatMap((item): unknown[] => typeof item === 'string' ? item.split(',') : [item])
    .map((item): unknown => typeof item === 'string' && /^\d+$/.test(item.trim()) ? Number(item.trim()) : item);
/** Lista de identificadores na query: aceita `3`, `3,5` ou o parâmetro repetido (`?id=3&id=5`). */
export const IdsRegistro = (): PropertyDecorator => applyDecorators(Transform(listaIds), IsArray(), ArrayMaxSize(20), ArrayUnique(), IsInt({ each: true }), Min(1, { each: true }));

export const aparar = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() : value;
export const booleano = ({ value }: { value: unknown }): unknown => value === 'true' ? true : value === 'false' ? false : value;
export const decimal = ({ value }: { value: unknown }): unknown => typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
export const definido = (_objeto: unknown, valor: unknown): boolean => valor !== undefined;
export const informado = (_objeto: unknown, valor: unknown): boolean => valor !== undefined && valor !== null;
