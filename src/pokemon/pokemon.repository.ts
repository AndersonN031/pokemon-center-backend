import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Pokemon } from './pokemon.entity';
import { CreatePokemonDto } from './dto/create-pokemon.dto';
import { UpdatePokemonDto } from './dto/update-pokemon.dto';
import { POKEMON_NOT_FOUND } from './pokemon.constants';

@Injectable()
export class PokemonRepository {
  constructor(private prisma: PrismaService) {}

  async globalListPokemons(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const pokemons = await this.prisma.pokemon.findMany({
      skip,
      take: limit,
      orderBy: {
        pokedexNumber: 'asc',
      },
    });

    const total = await this.prisma.pokemon.count();

    return {
      data: pokemons,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
  async findAll(userId: string): Promise<Pokemon | any> {
    return this.prisma.pokemon.findMany({
      where: {
        createdBy: userId,
      },
    });
  }

  async findById(id: string): Promise<Pokemon | any> {
    const pokemon = await this.prisma.pokemon.findUnique({
      where: {
        id,
      },
    });

    if (!pokemon) {
      throw new NotFoundException([POKEMON_NOT_FOUND]);
    }

    return pokemon;
  }

  async create(data: CreatePokemonDto, userId: string): Promise<Pokemon | any> {
    const findUserById = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!findUserById) {
      throw new NotFoundException([POKEMON_NOT_FOUND]);
    }

    const pokemon = await this.prisma.pokemon.create({
      data: {
        ...data,
        createdBy: userId,
      },
    });

    return pokemon;
  }

  async update(
    data: UpdatePokemonDto,
    userId: string,
    id: string,
  ): Promise<Pokemon | any> {
    const findPokemonById = await this.prisma.pokemon.findUnique({
      where: {
        id: id,
      },
    });

    if (!findPokemonById || findPokemonById.createdBy !== userId) {
      throw new NotFoundException([POKEMON_NOT_FOUND]);
    }

    const pokemon = await this.prisma.pokemon.update({
      where: {
        id: id,
      },
      data,
    });

    return pokemon;
  }

  async delete(id: string, userId: string) {
    const findPokemonById = await this.prisma.pokemon.findUnique({
      where: {
        id,
      },
    });

    if (!findPokemonById || findPokemonById.createdBy !== userId) {
      throw new NotFoundException([POKEMON_NOT_FOUND]);
    } else {
      await this.prisma.pokemon.delete({
        where: {
          id,
        },
      });
    }
  }
}
