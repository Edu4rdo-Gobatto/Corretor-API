import { ArrayMaxSize, ArrayUnique, IsArray, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class CriarVideoEmbedDto {
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048) url!: string;
}

export class ReordenarMidiasDto {
  @IsArray() @ArrayMaxSize(500) @ArrayUnique() @IsUUID('4', { each: true }) midias_ids!: string[];
}
