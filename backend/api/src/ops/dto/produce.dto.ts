import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ProduceDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0000001)
  qty!: number;
}
