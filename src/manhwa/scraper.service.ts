import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import axios, { AxiosError } from 'axios';
import * as https from 'https';

export interface ScrapedManhwa {
  title: string;
  slug: string;
  cover?: string;
  description?: string;
  author?: string;
  artist?: string;
  status?: string;
  genres: string[];
  chapters?: number;
  source: string;
  sourceUrl: string;
}

export interface ScrapedChapter {
  number: number;
  title?: string;
  sourceUrl: string;
  pages: string[];
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  // ─── Rate limiting state ─────────────────────────────────────
  private lastRequestAt = 0;
  private consecutiveErrors = 0;

  private readonly MIN_DELAY_MS = 3000;
  private readonly BASE_BACKOFF_MS = 10000;
  private readonly MAX_BACKOFF_MS = 120000;
  private readonly MAX_RETRIES = 4;

  private readonly httpClient = axios.create({
    timeout: 20000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    },
  });

  // ─── Core fetch com retry + backoff exponencial ──────────────

  async fetchPage(url: string, attempt = 1): Promise<string | null> {
    // Garante intervalo mínimo entre requests
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < this.MIN_DELAY_MS) {
      await this.delay(this.MIN_DELAY_MS - elapsed);
    }
    this.lastRequestAt = Date.now();

    try {
      const response = await this.httpClient.get<string>(url);
      this.consecutiveErrors = 0;
      return response.data;
    } catch (error: any) {
      const status = (error as AxiosError)?.response?.status;

      // ── 429 Too Many Requests ───────────────────────────────
      if (status === 429) {
        this.consecutiveErrors++;

        if (attempt > this.MAX_RETRIES) {
          this.logger.error(
            `[429] Desistindo de ${url} após ${attempt - 1} tentativas`,
          );
          return null;
        }

        // Backoff exponencial com cap: 10s → 20s → 40s → 80s → 120s
        const backoff = Math.min(
          this.BASE_BACKOFF_MS * Math.pow(2, attempt - 1),
          this.MAX_BACKOFF_MS,
        );

        // Respeita Retry-After se o servidor enviar
        const retryAfterRaw = (error as AxiosError)?.response?.headers?.[
          'retry-after'
        ];
        const retryAfterMs = retryAfterRaw
          ? parseInt(String(retryAfterRaw), 10) * 1000
          : backoff;

        const waitMs = Math.max(retryAfterMs, backoff);
        this.logger.warn(
          `[429] Tentativa ${attempt}/${this.MAX_RETRIES} — aguardando ${(waitMs / 1000).toFixed(0)}s → ${url}`,
        );

        await this.delay(waitMs);
        return this.fetchPage(url, attempt + 1);
      }

      // ── 403 / 503 ───────────────────────────────────────────
      if ((status === 403 || status === 503) && attempt <= 2) {
        const wait = 15000 * attempt;
        this.logger.warn(
          `[${status}] Tentativa ${attempt}, aguardando ${wait / 1000}s → ${url}`,
        );
        await this.delay(wait);
        return this.fetchPage(url, attempt + 1);
      }

      this.logger.error(
        `Falha ao buscar ${url}: ${error.message} (status ${status ?? 'N/A'})`,
      );
      return null;
    }
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private extractSlugFromUrl(url: string): string {
    return url.replace(/\/$/, '').split('/').pop() ?? this.slugify(url);
  }

  // ─── LIST SCRAPER ────────────────────────────────────────────

  async scrapeNocfsbList(page = 1): Promise<ScrapedManhwa[]> {
    const url = `https://nocfsb.com/manga/?page=${page}`;
    this.logger.log(`Scraping nocfsb list page ${page}: ${url}`);

    const html = await this.fetchPage(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const manhwas: ScrapedManhwa[] = [];
    const seen = new Set<string>();

    $('div.page-item-detail, div.c-image-hover').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('h3 a, .h5 a').first();
      const title = $a.attr('title') || $a.text().trim();
      const sourceUrl = $a.attr('href') || '';
      const cover =
        $el.find('img').first().attr('data-src') ||
        $el.find('img').first().attr('src') ||
        '';
      const author =
        $el.find('.mg_author a').first().text().trim() || undefined;

      if (!title || !sourceUrl || seen.has(sourceUrl)) return;
      if (!sourceUrl.match(/\/manga\/[a-z0-9-]+\/?$/)) return;

      seen.add(sourceUrl);
      manhwas.push({
        title,
        slug: this.extractSlugFromUrl(sourceUrl),
        cover,
        author,
        genres: [],
        source: 'nocfsb',
        sourceUrl,
      });
    });

    this.logger.log(`Found ${manhwas.length} manhwas on nocfsb page ${page}`);
    return manhwas;
  }

  // ─── DETAIL SCRAPER ──────────────────────────────────────────

  async scrapeNocfsbDetail(url: string): Promise<Partial<ScrapedManhwa>> {
    const html = await this.fetchPage(url);
    if (!html) return {};

    const $ = cheerio.load(html);

    const cover =
      $('.summary_image img').attr('src') ||
      $('.summary_image img').attr('data-src') ||
      undefined;

    const description =
      $('.description-summary p').first().text().trim() ||
      $('.summary__content p').first().text().trim() ||
      undefined;

    let author: string | undefined;
    let artist: string | undefined;
    let status: string | undefined;
    const genres: string[] = [];

    $('.post-content_item').each((_, el) => {
      const heading = $(el)
        .find('.summary-heading')
        .text()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const $content = $(el).find('.summary-content');

      if (heading.includes('autor')) {
        author =
          $content.find('a').first().text().trim() ||
          $content.text().trim() ||
          undefined;
      } else if (heading.includes('artist')) {
        artist =
          $content.find('a').first().text().trim() ||
          $content.text().trim() ||
          undefined;
      } else if (heading.includes('estado') || heading.includes('status')) {
        status = $content.text().trim() || undefined;
      } else if (heading.includes('genero') || heading.includes('genre')) {
        $content.find('a').each((_, a) => {
          const g = $(a).text().trim();
          if (g) genres.push(g);
        });
      }
    });

    if (genres.length === 0) {
      $('a[href*="manga-genre"]').each((_, el) => {
        const g = $(el).text().trim();
        if (g) genres.push(g);
      });
    }

    if (!status) {
      const h1 = $('h1').first().text();
      if (h1.includes('🟢')) status = 'Ativo';
      else if (h1.includes('🔴')) status = 'Concluído';
      else if (h1.includes('🟡')) status = 'Hiato';
    }

    const chapters =
      $(
        'ul.main-version-detail li a, .wp-manga-chapter a, li.wp-manga-chapter a',
      ).length || undefined;

    return { cover, description, author, artist, status, genres, chapters };
  }

  // ─── CHAPTER PAGE SCRAPER ────────────────────────────────────

  async scrapeNocfsbChapter(
    url: string,
    number: number,
  ): Promise<ScrapedChapter | null> {
    const html = await this.fetchPage(url);
    if (!html) return null;

    const $ = cheerio.load(html);
    const pages: string[] = [];
    const seen = new Set<string>();

    // Seletores em ordem de prioridade (do mais específico ao mais genérico)
    const imgSelectors = [
      '#readerarea img',
      '.reading-content img',
      '.entry-content img',
      'article img',
    ];

    for (const selector of imgSelectors) {
      $(selector).each((_, el) => {
        const src = (
          $(el).attr('src') ||
          $(el).attr('data-src') ||
          $(el).attr('data-lazy-src') ||
          $(el).attr('data-original') ||
          ''
        ).trim();

        if (
          src.startsWith('http') &&
          !seen.has(src) &&
          !src.includes('placeholder') &&
          !src.includes('avatar') &&
          !src.includes('logo') &&
          /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(src)
        ) {
          seen.add(src);
          pages.push(src);
        }
      });

      if (pages.length > 0) break;
    }

    // Fallback: tenta extrair URLs de variáveis JS (padrão WP Manga Reader)
    if (pages.length === 0) {
      // Tenta ts_reader.run({"sources":[{"images":["..."]}]})
      const tsMatch = html.match(/ts_reader\.run\((\{.*?\})\)/s);
      if (tsMatch) {
        try {
          const data = JSON.parse(tsMatch[1]);
          const images: string[] =
            data?.sources?.[0]?.images ??
            data?.sources?.flatMap((s: any) => s.images ?? []) ??
            [];
          images.forEach((u) => {
            if (u.startsWith('http') && !seen.has(u)) {
              seen.add(u);
              pages.push(u);
            }
          });
        } catch {
          // ignora erros de parse
        }
      }
    }

    if (pages.length === 0) {
      this.logger.warn(
        `Nenhuma imagem encontrada no capítulo ${number}: ${url}`,
      );
    } else {
      this.logger.log(
        `Capítulo ${number}: ${pages.length} páginas extraídas de ${url}`,
      );
    }

    return { number, sourceUrl: url, pages };
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
