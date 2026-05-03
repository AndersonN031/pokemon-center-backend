import { Test, TestingModule } from '@nestjs/testing';
import { ManhwaService } from './manhwa.service';

describe('ManhwaService', () => {
  let service: ManhwaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManhwaService],
    }).compile();

    service = module.get<ManhwaService>(ManhwaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
