import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Pokemon } from './pokemon.entity';
import { CreatePokemonDto } from './dto/create-pokemon.dto';

@Injectable()
export class PokemonRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Pokemon | any> {
    return this.prisma.pokemon.findMany();
  }


  async create(data: CreatePokemonDto, userId: string): Promise<Pokemon | any> {
    const findUserById = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!findUserById) {
      throw new Error('User not found');
    }

    const pokemon = await this.prisma.pokemon.create({
      data: {
        ...data,
        createdBy: userId,
      },
    });

    return pokemon;
  }
}
