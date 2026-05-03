import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import axios from 'axios';
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

  private readonly httpClient = axios.create({
    timeout: 15000,
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

  private async fetchPage(url: string): Promise<string | null> {
    try {
      const response = await this.httpClient.get<string>(url);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to fetch ${url}: ${error.message}`);
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
    // https://nocfsb.com/manga/azar-do-cavalo/ → "azar-do-cavalo"
    return url.replace(/\/$/, '').split('/').pop() ?? this.slugify(url);
  }

  // ─────────────────────────────────────────────
  //  LIST SCRAPER
  //  URL: https://nocfsb.com/manga/?page=N
  //
  //  Observed structure:
  //  Each item has: img + h3 > a[href, title] + .mg_author a
  // ─────────────────────────────────────────────
  async scrapeNocfsbList(page = 1): Promise<ScrapedManhwa[]> {
    const url = `https://nocfsb.com/manga/?page=${page}`;
    this.logger.log(`Scraping nocfsb list page ${page}: ${url}`);

    const html = await this.fetchPage(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const manhwas: ScrapedManhwa[] = [];
    const seen = new Set<string>();

    // Seletor correto para o tema do nocfsb
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

  // ─────────────────────────────────────────────
  //  DETAIL SCRAPER
  //  URL: https://nocfsb.com/manga/slug/
  //
  //  Observed structure:
  //  .summary_image img           → cover
  //  .description-summary p       → synopsis
  //  .post-content_item           → each metadata row (autor, artista, gênero, estado)
  //   └ .summary-heading          → label
  //   └ .summary-content          → value / links
  //  ul.main-version-detail li    → chapter list
  // ─────────────────────────────────────────────
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
        // Status may contain emoji like "🟢 Ativo"
        status = $content.text().trim() || undefined;
      } else if (heading.includes('genero') || heading.includes('genre')) {
        $content.find('a').each((_, a) => {
          const g = $(a).text().trim();
          if (g) genres.push(g);
        });
      }
    });

    // Genre fallback from breadcrumb or sidebar links
    if (genres.length === 0) {
      $('a[href*="manga-genre"]').each((_, el) => {
        const g = $(el).text().trim();
        if (g) genres.push(g);
      });
    }

    // Status fallback from page title emoji
    if (!status) {
      const h1 = $('h1').first().text();
      if (h1.includes('🟢')) status = 'Ativo';
      else if (h1.includes('🔴')) status = 'Concluído';
      else if (h1.includes('🟡')) status = 'Hiato';
    }

    // Chapter count: count all chapter links
    const chapters =
      $(
        'ul.main-version-detail li a, .wp-manga-chapter a, li.wp-manga-chapter a',
      ).length || undefined;

    return { cover, description, author, artist, status, genres, chapters };
  }

  // ─────────────────────────────────────────────
  //  CHAPTER SCRAPER
  //  URL: https://nocfsb.com/manga/slug/capitulo-X/
  //
  //  Images inside #readerarea img
  // ─────────────────────────────────────────────
  async scrapeNocfsbChapter(
    url: string,
    number: number,
  ): Promise<ScrapedChapter | null> {
    const html = await this.fetchPage(url);
    if (!html) return null;

    const $ = cheerio.load(html);
    const pages: string[] = [];

    $('#readerarea img, .reading-content img').each((_, el) => {
      const src =
        $(el).attr('src') ||
        $(el).attr('data-src') ||
        $(el).attr('data-lazy-src');
      if (src && src.startsWith('http')) pages.push(src);
    });

    return { number, sourceUrl: url, pages };
  }
}
