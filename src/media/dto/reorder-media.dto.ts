import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderMediaDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  mediaIds!: string[];
}
