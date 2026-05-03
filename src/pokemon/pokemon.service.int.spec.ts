import { Test, TestingModule } from '@nestjs/testing';
import { PokemonService } from './pokemon.service';
import { PokemonRepository } from './pokemon.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('PokemonService (integration)', () => {
  let service: PokemonService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [PokemonService, PokemonRepository, PrismaService],
    }).compile();

    service = moduleRef.get(PokemonService);
  });

  it('should return pokemons from database', async () => {
    const userId = 'dc7595b9-18a1-47e4-9c81-fce51adff413';

    const result = await service.findAll(userId);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  }, 30000);
});
