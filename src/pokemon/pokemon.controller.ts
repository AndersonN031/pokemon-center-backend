import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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

@UseGuards(JwtAuthGuard)
@Controller('pokemon')
export class PokemonController {
  constructor(private pokemonService: PokemonService) {}

  @Get()
  async findAll(@Res() res): Promise<Pokemon> {
    const pokemon = await this.pokemonService.findAll();
    return res.status(200).json(pokemon);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Res() res): Promise<Pokemon> {
    const pokemon = await this.pokemonService.findById(id);
    return res.status(200).json(pokemon);
  }

  @Post('/create')
  async create(
    @Body() data: CreatePokemonDto,
    @Req() req,
    @Res() res,
  ): Promise<Pokemon> {
    const userId = req.user.userId;
    const pokemon = await this.pokemonService.create(data, userId);
    return res.status(201).json(pokemon);
  }

  @Patch('/update/:id')
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

  @Delete('/delete/:id')
  async delete(@Param('id') id: string, @Req() req, @Res() res) {
    const userId = req.user.userId;
    await this.pokemonService.delete(id, userId);
    return res.status(200).json({ message: POKEMON_DELETE_SUCCESS });
  }
}
