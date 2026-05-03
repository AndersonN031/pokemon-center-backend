import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  ParseFloatPipe,
} from '@nestjs/common';
import { ManhwaService } from './manhwa.service';

@Controller('manhwa')
export class ManhwaController {
  constructor(private readonly manhwaService: ManhwaService) {}

  // GET /manhwa?page=1&limit=20&source=nocturne&status=ongoing&search=title
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.manhwaService.findAll({ page, limit, source, status, search });
  }

  // GET /manhwa/logs
  @Get('logs')
  getLogs(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.manhwaService.getScrapingLogs(limit);
  }

  // POST /manhwa/scrape?pages=3
  @Post('scrape')
  scrapeAll(
    @Query('pages', new DefaultValuePipe(3), ParseIntPipe) pages: number,
  ) {
    return this.manhwaService.runScrapeAll(pages);
  }

  // POST /manhwa/scrape/nocfsb?pages=3
  @Post('scrape/nocfsb')
  scrapeNocfsb(
    @Query('pages', new DefaultValuePipe(3), ParseIntPipe) pages: number,
  ) {
    return this.manhwaService.runScrapeSource('nocfsb', pages);
  }

  // POST /manhwa/scrape-all-chapters
  @Post('scrape-all-chapters')
  scrapeAllChapters() {
    return this.manhwaService.runScrapeAllChapters();
  }

  // POST /manhwa/:slug/scrape-chapters
  @Post(':slug/scrape-chapters')
  scrapeChapters(@Param('slug') slug: string) {
    return this.manhwaService.runScrapeChapters(slug);
  }

  // GET /manhwa/:slug
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.manhwaService.findOne(slug);
  }

  // GET /manhwa/:slug/chapter/:number
  @Get(':slug/chapter/:number')
  findChapter(
    @Param('slug') slug: string,
    @Param('number', ParseFloatPipe) number: number,
  ) {
    return this.manhwaService.findChapter(slug, number);
  }
}
