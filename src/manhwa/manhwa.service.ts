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
      include: { ManhwaChapter: { orderBy: { number: 'desc' }, take: 500 } },
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
    this.scrapeChaptersForManhwa(log.id, manhwa).catch(() => {});
    return { message: 'Chapter scraping started', logId: log.id };
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

  // ─── NOVO: corrige capítulos sem páginas ─────────────────────────────────
  // Chame POST /manhwa/fix-empty-chapters?slug=azar-do-cavalo (ou sem slug para todos)
  async runFixEmptyChapters(slug?: string) {
    const where: any = { pages: { isEmpty: true } };
    if (slug) {
      const manhwa = await this.prisma.manhwa.findUnique({ where: { slug } });
      if (!manhwa) throw new NotFoundException(`Manhwa "${slug}" not found`);
      where.manhwaId = manhwa.id;
    }
    const emptyChapters = await this.prisma.manhwaChapter.findMany({ where });
    const log = await this.prisma.scrapingLog.create({
      data: {
        source: 'nocfsb',
        status: 'running',
        message: `Corrigindo ${emptyChapters.length} capítulos sem páginas${slug ? ` de "${slug}"` : ''}`,
      },
    });
    this.fixEmptyChaptersInBackground(log.id, emptyChapters).catch(() => {});
    return {
      message: `Re-scraping ${emptyChapters.length} empty chapters`,
      logId: log.id,
    };
  }

  // ─── Background workers ───────────────────────────────────────────────────

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
          } catch (err: any) {
            this.logger.warn(`Error saving ${item.title}: ${err.message}`);
          }
        }
        await this.prisma.scrapingLog.update({
          where: { id: logId },
          data: {
            itemsFound: total,
            message: `Scraped ${total} items from ${source} (pág ${p}/${pages})`,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Scrape failed for ${source}: ${err.message}`);
    }
    return total;
  }

  private async scrapeChaptersForManhwa(logId: string, manhwa: any) {
    let total = 0;
    try {
      const chapterLinks = await this.extractChapterLinks(manhwa.sourceUrl);
      this.logger.log(
        `Found ${chapterLinks.length} chapters for ${manhwa.title}`,
      );

      for (const ch of chapterLinks) {
        try {
          const exists = await this.prisma.manhwaChapter.findUnique({
            where: {
              manhwaId_number: { manhwaId: manhwa.id, number: ch.number },
            },
          });

          // Pula somente se já existe COM páginas
          if (
            exists &&
            Array.isArray(exists.pages) &&
            (exists.pages as string[]).length > 0
          )
            continue;

          const chapter = await this.scraper.scrapeNocfsbChapter(
            ch.url,
            ch.number,
          );
          if (!chapter) continue;

          if (exists) {
            await this.prisma.manhwaChapter.update({
              where: { id: exists.id },
              data: { pages: chapter.pages, title: ch.title },
            });
          } else {
            await this.prisma.manhwaChapter.create({
              data: {
                manhwaId: manhwa.id,
                number: chapter.number,
                title: ch.title,
                sourceUrl: ch.url,
                pages: chapter.pages,
              },
            });
          }

          total++;
          await this.prisma.scrapingLog.update({
            where: { id: logId },
            data: {
              itemsFound: total,
              message: `Cap. ${ch.number} (${chapter.pages.length} pgs) — total: ${total}`,
            },
          });
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
          message: `Concluído: ${total} capítulos para ${manhwa.title}`,
        },
      });
    } catch (err: any) {
      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: { status: 'error', message: err.message },
      });
    }
  }

  private async scrapeAllChaptersInBackground(logId: string) {
    let totalChapters = 0;
    let processedManhwas = 0;

    try {
      const manhwas = await this.prisma.manhwa.findMany({
        orderBy: { createdAt: 'asc' },
      });
      this.logger.log(`Starting chapter scrape for ${manhwas.length} manhwas`);

      for (const manhwa of manhwas) {
        try {
          this.logger.log(
            `[${processedManhwas + 1}/${manhwas.length}] ${manhwa.title}`,
          );
          const chapterLinks = await this.extractChapterLinks(manhwa.sourceUrl);

          // Processa em batches de 5
          const BATCH = 5;
          for (let i = 0; i < chapterLinks.length; i += BATCH) {
            const batch = chapterLinks.slice(i, i + BATCH);

            for (const ch of batch) {
              try {
                const exists = await this.prisma.manhwaChapter.findUnique({
                  where: {
                    manhwaId_number: { manhwaId: manhwa.id, number: ch.number },
                  },
                });

                // Pula se já tem páginas
                if (
                  exists &&
                  Array.isArray(exists.pages) &&
                  (exists.pages as string[]).length > 0
                )
                  continue;

                const chapter = await this.scraper.scrapeNocfsbChapter(
                  ch.url,
                  ch.number,
                );
                if (!chapter) continue;

                if (exists) {
                  await this.prisma.manhwaChapter.update({
                    where: { id: exists.id },
                    data: { pages: chapter.pages, title: ch.title },
                  });
                } else {
                  await this.prisma.manhwaChapter.create({
                    data: {
                      manhwaId: manhwa.id,
                      number: chapter.number,
                      title: ch.title,
                      sourceUrl: ch.url,
                      pages: chapter.pages,
                    },
                  });
                }

                totalChapters++;
              } catch (err: any) {
                this.logger.warn(
                  `Erro cap. ${ch.number} de ${manhwa.title}: ${err.message}`,
                );
              }
            }

            await this.prisma.scrapingLog.update({
              where: { id: logId },
              data: {
                itemsFound: totalChapters,
                message: `[${processedManhwas + 1}/${manhwas.length}] "${manhwa.title}" — ${totalChapters} caps salvos`,
              },
            });

            // Pausa entre batches de capítulos
            if (i + BATCH < chapterLinks.length) await this.delay(5000);
          }

          processedManhwas++;
          // Pausa mais longa entre manhwas para deixar o servidor respirar
          await this.delay(8000);
        } catch (err: any) {
          this.logger.warn(`Erro processando ${manhwa.title}: ${err.message}`);
        }
      }

      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: {
          status: 'success',
          itemsFound: totalChapters,
          message: `Concluído! ${totalChapters} caps de ${processedManhwas} manhwas`,
        },
      });
    } catch (err: any) {
      await this.prisma.scrapingLog.update({
        where: { id: logId },
        data: { status: 'error', message: err.message },
      });
    }
  }

  private async fixEmptyChaptersInBackground(logId: string, chapters: any[]) {
    let fixed = 0;
    for (const ch of chapters) {
      try {
        const scraped = await this.scraper.scrapeNocfsbChapter(
          ch.sourceUrl,
          ch.number,
        );
        if (scraped && scraped.pages.length > 0) {
          await this.prisma.manhwaChapter.update({
            where: { id: ch.id },
            data: { pages: scraped.pages },
          });
          fixed++;
          this.logger.log(
            `Fixed cap. ${ch.number} — ${scraped.pages.length} páginas`,
          );
        } else {
          this.logger.warn(
            `Cap. ${ch.number} ainda sem páginas: ${ch.sourceUrl}`,
          );
        }
        await this.prisma.scrapingLog.update({
          where: { id: logId },
          data: {
            itemsFound: fixed,
            message: `${fixed}/${chapters.length} capítulos corrigidos`,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Erro ao corrigir cap. ${ch.number}: ${err.message}`);
      }
    }
    await this.prisma.scrapingLog.update({
      where: { id: logId },
      data: {
        status: 'success',
        itemsFound: fixed,
        message: `Correção: ${fixed}/${chapters.length} capítulos`,
      },
    });
  }

  // ─── Helper: extrai links de capítulos ───────────────────────────────────
  private async extractChapterLinks(
    manhwaUrl: string,
  ): Promise<{ url: string; number: number; title?: string }[]> {
    const html = await this.scraper.fetchPage(manhwaUrl);
    if (!html) return [];

    const { load } = await import('cheerio');
    const $ = load(html);
    const links: { url: string; number: number; title?: string }[] = [];

    $('ul.main-version-detail li a, .wp-manga-chapter a').each((_, el) => {
      const $el = $(el);
      const url = ($el.attr('href') || '').trim();
      const text = $el.text().trim();
      const match = text.match(/[\d]+([.,]\d+)?/);
      const number = match ? parseFloat(match[0].replace(',', '.')) : null;
      if (url && number !== null) links.push({ url, number, title: text });
    });

    return links;
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
