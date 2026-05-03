import { Test, TestingModule } from '@nestjs/testing';
import { ManhwaController } from './manhwa.controller';

describe('ManhwaController', () => {
  let controller: ManhwaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManhwaController],
    }).compile();

    controller = module.get<ManhwaController>(ManhwaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
