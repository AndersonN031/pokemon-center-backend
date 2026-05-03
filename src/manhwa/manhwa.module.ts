import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ManhwaService } from './manhwa.service';
import { ManhwaController } from './manhwa.controller';
import { ScraperService } from './scraper.service';

@Module({
  imports: [PrismaModule],
  controllers: [ManhwaController],
  providers: [ManhwaService, ScraperService],
  exports: [ManhwaService],
})
export class ManhwaModule {}
