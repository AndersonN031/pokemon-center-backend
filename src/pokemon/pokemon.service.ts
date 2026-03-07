import { Injectable } from '@nestjs/common';
import { PokemonRepository } from './pokemon.repository';
import { Pokemon } from './pokemon.entity';
import { CreatePokemonDto } from './dto/create-pokemon.dto';
import { UpdatePokemonDto } from './dto/update-pokemon.dto';

@Injectable()
export class PokemonService {
  constructor(private readonly pokemonRepository: PokemonRepository) {}

  async findAll(): Promise<Pokemon | any> {
    return this.pokemonRepository.findAll();
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

  async update(data: UpdatePokemonDto, userId: string): Promise<Pokemon | any> {
    try {
      return this.pokemonRepository.update(data, userId);
    } catch (error) {
      throw error;
    }
  }

  async delete(id: string) {
    try {
      await this.pokemonRepository.delete(id);
    } catch (error) {
      throw error;
    }
  }
}
