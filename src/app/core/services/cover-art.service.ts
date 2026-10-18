import { Injectable } from '@angular/core';

export type CoverSource = 'itunes' | 'anilist' | 'wikipedia';

export interface CoverCandidate {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  source: CoverSource;
  score: number;
}

const SOURCE_LABEL: Record<CoverSource, string> = {
  itunes: 'App Store',
  anilist: 'AniList',
  wikipedia: 'Wikipedia',
};

export function coverSourceLabel(source: CoverSource): string {
  return SOURCE_LABEL[source];
}

/* ------------------------------- similitud --------------------------------- */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function bigrams(value: string): Set<string> {
  const compact = value.replace(/\s+/g, '');
  const grams = new Set<string>();
  for (let i = 0; i < compact.length - 1; i += 1) grams.add(compact.slice(i, i + 2));
  return grams;
}

function diceCoefficient(a: string, b: string): number {
  const left = bigrams(a);
  const right = bigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

/** Puntúa de 0 a 100 qué tan probable es que un título corresponda a la búsqueda. */
export function titleScore(query: string, title: string): number {
  const needle = normalize(query);
  const haystack = normalize(title);
  if (!needle || !haystack) return 0;
  if (haystack === needle) return 100;
  let score = diceCoefficient(needle, haystack) * 70;
  if (haystack.startsWith(needle)) score = Math.max(score, 86 - Math.min(18, haystack.length - needle.length));
  else if (haystack.includes(needle)) score = Math.max(score, 74);
  else if (needle.includes(haystack)) score = Math.max(score, 58);
  return Math.round(score);
}

/* -------------------------------- servicio --------------------------------- */

/**
 * Buscador de portadas sin API keys.
 *
 * Consulta en paralelo App Store (iTunes), AniList y Wikipedia —las tres con
 * CORS abierto— y ordena los resultados por parecido con lo que escribiste.
 * La imagen elegida se descarga y se comprime a data URL para que quede dentro
 * del JSON de datos.
 */
@Injectable({ providedIn: 'root' })
export class CoverArtService {
  private readonly cache = new Map<string, CoverCandidate[]>();

  async search(query: string): Promise<CoverCandidate[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const cacheKey = normalize(trimmed);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const [itunes, anilist, wikipedia] = await Promise.allSettled([
      this.searchItunes(trimmed),
      this.searchAniList(trimmed),
      this.searchWikipedia(trimmed),
    ]);

    const merged: CoverCandidate[] = [];
    for (const result of [itunes, anilist, wikipedia]) {
      if (result.status === 'fulfilled') merged.push(...result.value);
    }

    const seen = new Set<string>();
    const ranked = merged
      .filter((candidate) => candidate.imageUrl && candidate.score > 0)
      .filter((candidate) => {
        if (seen.has(candidate.imageUrl)) return false;
        seen.add(candidate.imageUrl);
        return true;
      })
      .sort((a, b) => b.score - a.score);

    const relevant = ranked.filter((candidate) => candidate.score >= 30);
    const finalList = (relevant.length > 0 ? relevant : ranked.slice(0, 4)).slice(0, 12);
    this.cache.set(cacheKey, finalList);
    return finalList;
  }

  private async searchItunes(query: string): Promise<CoverCandidate[]> {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      query,
    )}&entity=software&limit=25&country=us`;
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`iTunes ${response.status}`);
    const payload = (await response.json()) as {
      results?: { trackName?: string; sellerName?: string; artworkUrl512?: string; artworkUrl100?: string; primaryGenreName?: string; trackId?: number }[];
    };
    return (payload.results ?? [])
      .map((item) => {
        const raw = item.artworkUrl512 ?? item.artworkUrl100 ?? '';
        const imageUrl = raw.replace(/100x100bb\.(jpg|png)/, '512x512bb.$1').replace('100x100', '512x512');
        const title = item.trackName ?? '';
        const isGame = /game|juego/i.test(item.primaryGenreName ?? '');
        return {
          id: `itunes-${item.trackId ?? title}`,
          title,
          subtitle: item.sellerName,
          imageUrl,
          source: 'itunes' as const,
          score: titleScore(query, title) + (isGame ? 12 : 0),
        };
      })
      .filter((candidate) => candidate.imageUrl && candidate.score > 0);
  }

  private async searchAniList(query: string): Promise<CoverCandidate[]> {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({
        query: `query ($search: String) {
          Page(perPage: 10) {
            media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
              id
              format
              title { romaji english native }
              coverImage { large }
            }
          }
        }`,
        variables: { search: query },
      }),
    });
    if (!response.ok) throw new Error(`AniList ${response.status}`);
    const payload = (await response.json()) as {
      data?: {
        Page?: {
          media?: {
            id: number;
            format?: string;
            title?: { romaji?: string; english?: string; native?: string };
            coverImage?: { large?: string };
          }[];
        };
      };
    };
    return (payload.data?.Page?.media ?? [])
      .map((media) => {
        const title = media.title?.english ?? media.title?.romaji ?? '';
        return {
          id: `anilist-${media.id}`,
          title,
          subtitle: [media.title?.native, media.format].filter(Boolean).join(' · '),
          imageUrl: media.coverImage?.large ?? '',
          source: 'anilist' as const,
          score: titleScore(query, title),
        };
      })
      .filter((candidate) => candidate.imageUrl && candidate.score > 0);
  }

  private async searchWikipedia(query: string): Promise<CoverCandidate[]> {
    const languages = ['es', 'en'];
    const results = await Promise.allSettled(
      languages.map(async (language) => {
        const url =
          `https://${language}.wikipedia.org/w/api.php?action=query&generator=search` +
          `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=8&prop=pageimages&piprop=thumbnail` +
          `&pithumbsize=512&format=json&formatversion=2&origin=*`;
        const response = await fetch(url, { credentials: 'omit' });
        if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
        const payload = (await response.json()) as {
          query?: { pages?: { pageid: number; title: string; thumbnail?: { source?: string } }[] };
        };
        return (payload.query?.pages ?? []).map((page) => ({
          id: `wikipedia-${language}-${page.pageid}`,
          title: page.title,
          subtitle: `Wikipedia ${language.toUpperCase()}`,
          imageUrl: page.thumbnail?.source ?? '',
          source: 'wikipedia' as const,
          score: Math.round(titleScore(query, page.title) * 0.85),
        }));
      }),
    );
    return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }

  /* --------------------------- imagen → data URL ---------------------------- */

  /** Descarga la imagen y la comprime en un cuadrado. Devuelve data URL o la URL original. */
  async toCoverDataUrl(url: string, size = 320, quality = 0.82): Promise<string> {
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return await this.blobToCoverDataUrl(blob, size, quality);
    } catch {
      return url;
    }
  }

  async fileToCoverDataUrl(file: File, size = 320, quality = 0.82): Promise<string> {
    return this.blobToCoverDataUrl(file, size, quality);
  }

  private async blobToCoverDataUrl(blob: Blob, size: number, quality: number): Promise<string> {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return '';
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await this.loadImage(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) return objectUrl;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const side = Math.min(width, height);
      const sourceX = (width - side) / 2;
      const sourceY = (height - side) / 2;
      context.drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size);

      const webp = canvas.toDataURL('image/webp', quality);
      return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
    } catch {
      return objectUrl;
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      image.src = src;
    });
  }
}
