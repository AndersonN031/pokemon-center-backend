import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('PokemonController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    await app.init();

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'ash@pokemon.com',
      password: 'Ash@123',
    });

    token = login.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /pokemon/all should return paginated pokemons', async () => {
    const response = await request(app.getHttpServer())
      .get('/pokemon/all?page=1&limit=20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    console.log(response.body);
    expect(response.body).toBeDefined();

    expect(Array.isArray(response.body.data)).toBe(true);
  }, 30000);
});
