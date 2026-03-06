import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Pokemon } from './pokemon.entity';
import { PokemonService } from './pokemon.service';
import { CreatePokemonDto } from './dto/create-pokemon.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('pokemon')
export class PokemonController {
  constructor(private pokemonService: PokemonService) {}

  @Get()
  async findAll(@Res() res): Promise<Pokemon> {
    const pokemon = await this.pokemonService.findAll();
    return res.status(200).json(pokemon);
  }

  @Post()
  async create(
    @Body() data: CreatePokemonDto,
    @Req() req,
    @Res() res,
  ): Promise<Pokemon> {
    const userId = req.user.userId;
    const pokemon = await this.pokemonService.create(data, userId);
    return res.status(201).json(pokemon);
  }
}
