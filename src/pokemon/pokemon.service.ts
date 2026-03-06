import { Injectable } from '@nestjs/common';
import { PokemonRepository } from './pokemon.repository';
import { Pokemon } from './pokemon.entity';
import { CreatePokemonDto } from './dto/create-pokemon.dto';

@Injectable()
export class PokemonService {
  constructor(private readonly pokemonRepository: PokemonRepository) {}

  async findAll(): Promise<Pokemon | any> {
    return this.pokemonRepository.findAll();
  }

  async create(data: CreatePokemonDto, userId: string): Promise<Pokemon | any> {
    try {
      return this.pokemonRepository.create(data, userId);
    } catch (error) {
      throw error;
    }
  }
}
