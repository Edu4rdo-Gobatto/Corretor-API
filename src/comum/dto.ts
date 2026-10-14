import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, Max, Min } from 'class-validator';

/** Identificador inteiro positivo (int4), aceito como número no corpo ou como texto na query. */
export const IdRegistro = (): PropertyDecorator => applyDecorators(Type(() => Number), IsInt(), Min(1), Max(2147483647));

export const aparar = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() : value;
export const booleano = ({ value }: { value: unknown }): unknown => value === 'true' ? true : value === 'false' ? false : value;
export const decimal = ({ value }: { value: unknown }): unknown => typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
export const definido = (_objeto: unknown, valor: unknown): boolean => valor !== undefined;
export const informado = (_objeto: unknown, valor: unknown): boolean => valor !== undefined && valor !== null;

/** Lista de ids na query: um id ou CSV (`1,2,3`). Itens não numéricos seguem como texto para a validação recusá-los. */
const csvIds = ({ value }: { value: unknown }): unknown => typeof value === 'number' ? [value]
  : typeof value === 'string' ? value.split(',').map(item => /^\d{1,10}$/.test(item.trim()) ? Number(item.trim()) : item) : value;

/** Até `maximo` ids inteiros positivos (int4); duplicados são removidos por quem consulta. */
export const ListaIds = (maximo: number): PropertyDecorator => applyDecorators(
  Transform(csvIds), IsArray(), ArrayNotEmpty(), ArrayMaxSize(maximo), IsInt({ each: true }), Min(1, { each: true }), Max(2147483647, { each: true }),
);
