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

  async runScrapeChapters(slug: string) {
    const manhwa = await this.prisma.manhwa.findUnique({ where: { slug } });
    if (!manhwa) throw new NotFoundException(`Manhwa "${slug}" not found`);

    const log = await this.prisma.scrapingLog.create({
      data: {
        source: manhwa.source,
        status: 'running',
        message: `Scraping chapters: ${slug}`,
      },
    });

    this.scrapeChaptersInBackground(log.id, manhwa).catch(() => {});
    return { message: 'Chapter scraping started', logId: log.id };
  }

  private async scrapeChaptersInBackground(logId: string, manhwa: any) {
    let total = 0;
    try {
      // 1. Busca lista de capítulos na página de detalhe
      const html = await this.scraper['fetchPage'](manhwa.sourceUrl);
      if (!html) throw new Error('Failed to fetch manhwa page');

      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);

      // Coleta todos os links de capítulo
      const chapterLinks: { url: string; number: number; title?: string }[] =
        [];

      $('ul.main-version-detail li a, .wp-manga-chapter a').each((_, el) => {
        const $el = $(el);
        const url = $el.attr('href') || '';
        const text = $el.text().trim();

        // Extrai número do capítulo do texto ex: "Capítulo 12" → 12
        const match = text.match(/[\d]+([.,]\d+)?/);
        const number = match ? parseFloat(match[0].replace(',', '.')) : null;

        if (url && number !== null) {
          chapterLinks.push({ url, number, title: text });
        }
      });

      this.logger.log(
        `Found ${chapterLinks.length} chapters for ${manhwa.title}`,
      );

      // 2. Para cada capítulo, raspa as páginas
      for (const ch of chapterLinks) {
        try {
          // Pula se já existe
          const exists = await this.prisma.manhwaChapter.findUnique({
            where: {
              manhwaId_number: { manhwaId: manhwa.id, number: ch.number },
            },
          });
          if (exists) continue;

          const chapter = await this.scraper.scrapeNocfsbChapter(
            ch.url,
            ch.number,
          );
          if (!chapter) continue;

          await this.prisma.manhwaChapter.create({
            data: {
              manhwaId: manhwa.id,
              number: chapter.number,
              title: ch.title,
              sourceUrl: ch.url,
              pages: chapter.pages,
            },
          });

          total++;
          await this.delay(800); // delay respeitoso entre capítulos
        } catch (err: any) {
          this.logger.warn(
            `Error scraping chapter ${ch.number}: ${err.message}`,
          );
        }
      }

      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: {
          status: 'success',
          itemsFound: total,
          message: `Scraped ${total} chapters for ${manhwa.title}`,
        },
      });
    } catch (err: any) {
      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: { status: 'error', message: err.message },
      });
    }
  }

  async runScrapeAllChapters() {
    const total = await this.prisma.manhwa.count();

    const log = await this.prisma.scrapingLog.create({
      data: {
        source: 'nocfsb',
        status: 'running',
        message: `Iniciando raspagem de capítulos de ${total} manhwas`,
      },
    });

    this.scrapeAllChaptersInBackground(log.id).catch(() => {});
    return {
      message: `Scraping chapters for ${total} manhwas started`,
      logId: log.id,
    };
  }

  private async scrapeAllChaptersInBackground(logId: string) {
    let totalChapters = 0;
    let processedManhwas = 0;

    try {
      // Busca todos os manhwas do banco
      const manhwas = await this.prisma.manhwa.findMany({
        orderBy: { createdAt: 'asc' },
      });

      this.logger.log(`Starting chapter scrape for ${manhwas.length} manhwas`);

      for (const manhwa of manhwas) {
        try {
          this.logger.log(
            `[${processedManhwas + 1}/${manhwas.length}] Scraping: ${manhwa.title}`,
          );

          const html = await this.scraper['fetchPage'](manhwa.sourceUrl);
          if (!html) {
            this.logger.warn(`Failed to fetch page for ${manhwa.title}`);
            continue;
          }

          const cheerio = await import('cheerio');
          const $ = cheerio.load(html);

          const chapterLinks: {
            url: string;
            number: number;
            title?: string;
          }[] = [];

          $('ul.main-version-detail li a, .wp-manga-chapter a').each(
            (_, el) => {
              const $el = $(el);
              const url = $el.attr('href') || '';
              const text = $el.text().trim();
              const match = text.match(/[\d]+([.,]\d+)?/);
              const number = match
                ? parseFloat(match[0].replace(',', '.'))
                : null;

              if (url && number !== null) {
                chapterLinks.push({ url, number, title: text });
              }
            },
          );

          this.logger.log(
            `Found ${chapterLinks.length} chapters for ${manhwa.title}`,
          );

          for (const ch of chapterLinks) {
            try {
              // Pula se já existe no banco
              const exists = await this.prisma.manhwaChapter.findUnique({
                where: {
                  manhwaId_number: { manhwaId: manhwa.id, number: ch.number },
                },
              });
              if (exists) continue;

              const chapter = await this.scraper.scrapeNocfsbChapter(
                ch.url,
                ch.number,
              );
              if (!chapter) continue;

              await this.prisma.manhwaChapter.create({
                data: {
                  manhwaId: manhwa.id,
                  number: chapter.number,
                  title: ch.title,
                  sourceUrl: ch.url,
                  pages: chapter.pages,
                },
              });

              totalChapters++;
              await this.delay(500);
            } catch (err: any) {
              this.logger.warn(
                `Error on chapter ${ch.number} of ${manhwa.title}: ${err.message}`,
              );
            }
          }

          processedManhwas++;

          // Atualiza o log com progresso a cada manhwa concluído
          await this.prisma.scrapingLog.update({
            where: { id: logId },
            data: {
              itemsFound: totalChapters,
              message: `[${processedManhwas}/${manhwas.length}] ${totalChapters} capítulos raspados até agora...`,
            },
          });

          await this.delay(1000); // delay entre manhwas
        } catch (err: any) {
          this.logger.warn(`Error processing ${manhwa.title}: ${err.message}`);
        }
      }

      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: {
          status: 'success',
          itemsFound: totalChapters,
          message: `Concluído! ${totalChapters} capítulos raspados de ${processedManhwas} manhwas`,
        },
      });
    } catch (err: any) {
      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: { status: 'error', message: err.message },
      });
    }
  }
}
