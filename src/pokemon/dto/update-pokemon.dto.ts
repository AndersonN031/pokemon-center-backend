import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdatePokemonDto {
  @ApiProperty({ example: 'Pikachu', description: 'Nome do pokemon' })
  @IsString()
  @MinLength(3, {
    message: 'O nome do pokemon deve ter no mínimo 3 caracteres',
  })
  @MaxLength(12, {
    message: 'O nome do pokemon deve ter no máximo 12 caracteres',
  })
  name: string;

  @ApiProperty({ example: 'Electric', description: 'Tipo do pokemon' })
  @IsString()
  @MinLength(1, {
    message: 'Mínimo 1 caracter',
  })
  @MaxLength(25, {
    message: 'Máximo 25 caracteres',
  })
  type: string;

  @ApiProperty({ example: 5, description: 'Nivel do pokemon' })
  @IsInt()
  @Max(100, { message: 'O nível máximo permitido é 100' })
  @Min(1, { message: 'O nível mínimo permitido é 1' })
  level: number;

  @ApiProperty({ example: 100, description: 'Os pontos de vida do pokemon' })
  @IsInt()
  @Max(999, { message: 'O HP máximo permitido é 999' })
  @Min(1, { message: 'O HP mínimo permitido é 1' })
  hp: number;

  @ApiProperty({ example: 25, description: 'O numero do pokemon na pokedex' })
  @IsInt()
  @Max(9999, { message: 'O número máximo é 9999' })
  @Min(1, { message: 'O número mínimo permitido é 1' })
  pokedexNumber: number;
}
