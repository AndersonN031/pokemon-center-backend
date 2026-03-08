import { Injectable } from '@nestjs/common';
import { PokemonRepository } from './pokemon.repository';
import { Pokemon } from './pokemon.entity';
import { CreatePokemonDto } from './dto/create-pokemon.dto';
import { UpdatePokemonDto } from './dto/update-pokemon.dto';

@Injectable()
export class PokemonService {
  constructor(private readonly pokemonRepository: PokemonRepository) {}

  async globalListPokemons(): Promise<Pokemon | any> {
    try {
      return this.pokemonRepository.globalListPokemons()
    } catch (error) {
      throw error;
    }
  }

  async findAll(userId: string): Promise<Pokemon | any> {
    try {
      return this.pokemonRepository.findAll(userId);
    } catch (error) {
      throw error;
    }
  }

  async findById(id: string): Promise<Pokemon | any> {
    try {
      return this.pokemonRepository.findById(id);
    } catch (error) {
      throw error;
    }
  }

  async create(data: CreatePokemonDto, userId: string): Promise<Pokemon | any> {
    try {
      return this.pokemonRepository.create(data, userId);
    } catch (error) {
      throw error;
    }
  }

  async update(
    data: UpdatePokemonDto,
    userId: string,
    id: string,
  ): Promise<Pokemon | any> {
    try {
      return this.pokemonRepository.update(data, userId, id);
    } catch (error) {
      throw error;
    }
  }

  async delete(id: string, userId: string) {
    try {
      await this.pokemonRepository.delete(id, userId);
    } catch (error) {
      throw error;
    }
  }
}
