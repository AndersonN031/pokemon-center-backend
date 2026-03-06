import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    console.log('Finding user by ID:', id);
    return this.prisma.user.findUnique({
      where: { id: id },
      // show pokemons
      include: { pokemons: true },
    });
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }
}
