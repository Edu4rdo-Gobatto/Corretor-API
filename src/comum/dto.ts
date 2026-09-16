import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/** Identificador inteiro positivo, aceito como número no corpo ou como texto na query. */
export const IdRegistro = (): PropertyDecorator => applyDecorators(Type(() => Number), IsInt(), Min(1));

export const aparar = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() : value;
export const booleano = ({ value }: { value: unknown }): unknown => value === 'true' ? true : value === 'false' ? false : value;
export const decimal = ({ value }: { value: unknown }): unknown => typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
export const definido = (_objeto: unknown, valor: unknown): boolean => valor !== undefined;
export const informado = (_objeto: unknown, valor: unknown): boolean => valor !== undefined && valor !== null;
