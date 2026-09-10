import { IsUrl } from 'class-validator';

export class CreateMediaEmbedDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;
}
