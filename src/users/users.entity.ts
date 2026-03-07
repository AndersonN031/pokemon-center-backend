import { Pokemon } from 'src/pokemon/pokemon.entity';

export class UsersEntity {
  id: string;
  name: string;
  email: string;
  pokemons: Pokemon[];
}