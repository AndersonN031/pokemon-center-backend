import { IsInt, IsString } from 'class-validator';

export class CreatePokemonDto {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsInt()
  level: number;

  @IsInt()
  hp: number;

  @IsInt()
  pokedexNumber: number;
}
