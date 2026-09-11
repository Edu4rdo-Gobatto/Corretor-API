import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[a-z0-9-]{1,120}$/.test(value)) throw new BadRequestException('Slug inválido.');
    return value;
  }
}
