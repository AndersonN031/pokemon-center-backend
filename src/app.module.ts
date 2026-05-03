import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

import { PokemonModule } from './pokemon/pokemon.module';
import { ManhwaModule } from './manhwa/manhwa.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, PokemonModule, ManhwaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
