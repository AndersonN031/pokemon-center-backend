import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class UpdatePokemonDto {
  @ApiProperty({ example: 'Pikachu', description: 'O nome do pokemon' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Electric', description: 'O tipo do pokemon' })
  @IsString()
  type: string;

  @ApiProperty({ example: 5, description: 'O nivel do pokemon' })
  @IsInt()
  level: number;

  @ApiProperty({ example: 100, description: 'Os pontos de vida do pokemon' })
  @IsInt()
  hp: number;

  @ApiProperty({ example: 25, description: 'O numero do pokemon na pokedex' })
  @IsInt()
  pokedexNumber: number;
}
