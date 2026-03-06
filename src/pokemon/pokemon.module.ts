import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PokemonController } from './pokemon.controller';
import { PokemonRepository } from './pokemon.repository';
import { PokemonService } from './pokemon.service';

@Module({
  imports: [PrismaModule],
  controllers: [PokemonController],
  providers: [PokemonRepository, PokemonService],
  exports: [PokemonService],
})
export class PokemonModule {}
