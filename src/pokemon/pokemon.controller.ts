import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Pokemon } from './pokemon.entity';
import { PokemonService } from './pokemon.service';
import { CreatePokemonDto } from './dto/create-pokemon.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdatePokemonDto } from './dto/update-pokemon.dto';
import { POKEMON_DELETE_SUCCESS } from './pokemon.constants';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pokemon')
@ApiTags('pokemon')
export class PokemonController {
  constructor(private pokemonService: PokemonService) {}

  @Get('all')
  async globalListPokemons(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Res() res,
  ): Promise<Pokemon> {
    const pokemon = await this.pokemonService.globalListPokemons(
      Number(page),
      Number(limit),
    );
    return res.status(200).json(pokemon);
  }

  @Get()
  async findAll(@Req() req, @Res() res): Promise<Pokemon> {
    const userId = req.user.userId;
    const pokemon = await this.pokemonService.findAll(userId);
    return res.status(200).json(pokemon);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Res() res): Promise<Pokemon> {
    const pokemon = await this.pokemonService.findById(id);
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

  @Patch(':id')
  async update(
    @Body() data: UpdatePokemonDto,
    @Param('id') id: string,
    @Req() req,
    @Res() res,
  ): Promise<Pokemon> {
    const userId = req.user.userId;
    const pokemon = await this.pokemonService.update(data, userId, id);
    return res.status(200).json(pokemon);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req, @Res() res) {
    const userId = req.user.userId;
    await this.pokemonService.delete(id, userId);
    return res.status(200).json({ message: POKEMON_DELETE_SUCCESS });
  }
}
