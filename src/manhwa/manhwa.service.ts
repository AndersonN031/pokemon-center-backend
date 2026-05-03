import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService } from './scraper.service';

@Injectable()
export class ManhwaService {
  private readonly logger = new Logger(ManhwaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraper: ScraperService,
  ) {}

  // ─── Public API ───────────────────────────────

  async findAll(params: {
    page?: number;
    limit?: number;
    source?: string;
    status?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, source, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (source) where.source = source;
    if (status) where.status = { contains: status, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.manhwa.count({ where }),
      this.prisma.manhwa.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { ManhwaChapter: true } } },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(slug: string) {
    const manhwa = await this.prisma.manhwa.findUnique({
      where: { slug },
      include: {
        ManhwaChapter: {
          orderBy: { number: 'desc' },
          take: 50,
        },
      },
    });

    if (!manhwa) throw new NotFoundException(`Manhwa "${slug}" not found`);
    return manhwa;
  }

  async findChapter(manhwaSlug: string, chapterNumber: number) {
    const manhwa = await this.prisma.manhwa.findUnique({
      where: { slug: manhwaSlug },
    });
    if (!manhwa)
      throw new NotFoundException(`Manhwa "${manhwaSlug}" not found`);

    const chapter = await this.prisma.manhwaChapter.findUnique({
      where: {
        manhwaId_number: { manhwaId: manhwa.id, number: chapterNumber },
      },
    });

    if (!chapter)
      throw new NotFoundException(`Chapter ${chapterNumber} not found`);
    return chapter;
  }

  async getScrapingLogs(limit = 20) {
    return this.prisma.scrapingLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Scraping Jobs ────────────────────────────

  async runScrapeAll(pages = 3) {
    const log = await this.prisma.scrapingLog.create({
      data: {
        source: 'nocfsb',
        status: 'running',
        message: 'Started scraping nocfsb',
      },
    });

    this.scrapeInBackground(log.id, pages).catch(() => {});
    return { message: 'Scraping started in background', logId: log.id };
  }

  async runScrapeSource(source: 'nocfsb', pages = 3) {
    const log = await this.prisma.scrapingLog.create({
      data: {
        source,
        status: 'running',
        message: `Started scraping ${source}`,
      },
    });

    this.scrapeSourceInBackground(log.id, source, pages).catch(() => {});
    return { message: `Scraping ${source} started`, logId: log.id };
  }

  // ─── Private Background Workers ───────────────

  private async scrapeInBackground(logId: string, pages: number) {
    let total = 0;
    try {
      total += await this.scrapeSourceInBackground(logId, 'nocfsb', pages);

      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: {
          status: 'success',
          itemsFound: total,
          message: `Scraped ${total} items total`,
        },
      });
    } catch (err: any) {
      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: { status: 'error', message: err.message },
      });
    }
  }

  private async scrapeSourceInBackground(
    logId: string,
    source: 'nocfsb',
    pages: number,
  ): Promise<number> {
    let total = 0;

    try {
      for (let p = 1; p <= pages; p++) {
        const list = await this.scraper.scrapeNocfsbList(p);

        for (const item of list) {
          try {
            const details = await this.scraper.scrapeNocfsbDetail(
              item.sourceUrl,
            );

            const merged = { ...item, ...details };

            await this.prisma.manhwa.upsert({
              where: { sourceUrl: merged.sourceUrl },
              create: {
                title: merged.title,
                slug: await this.uniqueSlug(merged.slug),
                cover: merged.cover,
                description: merged.description,
                author: merged.author,
                artist: merged.artist,
                status: merged.status,
                genres: merged.genres ?? [],
                chapters: merged.chapters,
                source: merged.source,
                sourceUrl: merged.sourceUrl,
              },
              update: {
                cover: merged.cover,
                description: merged.description,
                status: merged.status,
                genres: merged.genres ?? [],
                chapters: merged.chapters,
                updatedAt: new Date(),
              },
            });

            total++;
            await this.delay(500); // polite delay
          } catch (err: any) {
            this.logger.warn(`Error saving ${item.title}: ${err.message}`);
          }
        }
      }

      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: {
          itemsFound: total,
          message: `Scraped ${total} items from ${source}`,
        },
      });
    } catch (err: any) {
      this.logger.error(`Scrape failed for ${source}: ${err.message}`);
    }

    return total;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let counter = 1;
    while (await this.prisma.manhwa.findUnique({ where: { slug } })) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
