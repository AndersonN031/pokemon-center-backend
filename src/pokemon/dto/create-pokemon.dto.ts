import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class CreatePokemonDto {
  @ApiProperty({ example: 'Pikachu', description: 'Nome do pokemon' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Electric', description: 'Tipo do pokemon' })
  @IsString()
  type: string;

  @ApiProperty({ example: 5, description: 'Nivel do pokemon' })
  @IsInt()
  level: number;

  @ApiProperty({ example: 100, description: 'Os pontos de vida do pokemon' })
  @IsInt()
  hp: number;

  @ApiProperty({ example: 25, description: 'O numero do pokemon na pokedex' })
  @IsInt()
  pokedexNumber: number;
}
