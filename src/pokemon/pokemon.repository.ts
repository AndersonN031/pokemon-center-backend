import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Pokemon } from './pokemon.entity';
import { CreatePokemonDto } from './dto/create-pokemon.dto';
import { UpdatePokemonDto } from './dto/update-pokemon.dto';

@Injectable()
export class PokemonRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Pokemon | any> {
    return this.prisma.pokemon.findMany();
  }

  async findById(id: string): Promise<Pokemon | any> {
    const pokemon = await this.prisma.pokemon.findUnique({
      where: {
        id,
      },
    });

    if (!pokemon) {
      throw new NotFoundException('Pokemon not found');
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
      throw new NotFoundException('User not found');
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
      throw new NotFoundException('Pokemon not found');
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
      throw new NotFoundException('Pokemon not found');
    } else {
      await this.prisma.pokemon.delete({
        where: {
          id,
        },
      });
    }
  }
}
