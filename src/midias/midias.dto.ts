import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsUrl, MaxLength, Min } from 'class-validator';

export class CriarVideoEmbedDto {
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048) url!: string;
}

export class ReordenarMidiasDto {
  @IsArray() @ArrayMaxSize(500) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true }) midias_ids!: number[];
}
