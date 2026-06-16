export interface YouTubeVideo {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: string;
  embeddable: boolean;
}

export function buildSearchUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://www.youtube.com/results?search_query=${q}`;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function normalize(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractKeywords(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);
}

function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set(keywords);
  for (const k of keywords) {
    const singular = k.endsWith("es") ? k.slice(0, -2) : k.endsWith("s") ? k.slice(0, -1) : null;
    if (singular) expanded.add(singular);
  }
  return [...expanded];
}

function wordMatch(word: string, keyword: string): boolean {
  return word.includes(keyword) || levenshtein(word, keyword) <= 1;
}

function isRelevant(title: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const normalized = normalize(title);
  const expanded = expandKeywords(keywords);
  const words = normalized.split(/\s+/);
  const matches = expanded.filter((k) => words.some((w) => wordMatch(w, k))).length;
  return matches >= 1;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function checkEmbeddable(id: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) console.warn("[youtube] oEmbed rejected", id, res.status);
    return res.ok;
  } catch (err) {
    console.warn("[youtube] oEmbed error", id, err);
    return false;
  }
}

interface YouTubeSearchItem {
  id: string;
  type: string;
  title: string;
  channelTitle?: string;
  shortBylineText?: { runs: { text: string }[] };
  thumbnail?: { thumbnails: { url: string }[] };
  length?: { simpleText: string };
}

export async function searchYouTubeVideos(
  query: string,
  maxResults = 3,
  keywordQuery?: string
): Promise<YouTubeVideo[]> {
  try {
    const searchTerms = [
      `${query} ejercicios`,
      `${query} ejercicios resueltos`,
      `${query} tutorial`,
      `${query} explicacion`,
      `${query} clase`,
      `${query} ejemplos`,
    ];

    let youtubeApi: { GetListByKeyword: (q: string, b: boolean, n: number) => Promise<{ items: unknown[] }> };
    try {
      youtubeApi = await import("youtube-search-api");
    } catch (importErr) {
      console.error("[youtube] failed to import youtube-search-api:", importErr);
      return [];
    }

    const allItems: YouTubeSearchItem[] = [];
    for (const term of searchTerms) {
      if (allItems.length >= maxResults * 2) break;
      try {
        const result = await youtubeApi.GetListByKeyword(term, false, maxResults);
        if (result?.items?.length) {
          console.log(`[youtube] term "${term.slice(0, 40)}..." returned ${result.items.length} items`);
          allItems.push(...(result.items as YouTubeSearchItem[]));
        } else {
          console.warn(`[youtube] term "${term.slice(0, 40)}..." returned 0 items`);
        }
      } catch (searchErr) {
        console.warn(`[youtube] term "${term.slice(0, 40)}..." failed:`, searchErr);
      }
    }

    console.log(`[youtube] total raw items before dedup: ${allItems.length}`);

    if (allItems.length === 0) {
      console.warn("[youtube] no items from any search term, returning empty");
      return [];
    }

    const seen = new Set<string>();
    const keywords = extractKeywords(keywordQuery ?? query);

    const candidates = allItems
      .filter((item) => item.type === "video" && !seen.has(item.id) && seen.add(item.id))
      .slice(0, maxResults * 2);

    console.log(`[youtube] candidates after dedup/filter: ${candidates.length}`);

    const validated: YouTubeVideo[] = [];
    for (const item of candidates) {
      const title = item.title || "Sin título";
      if (!isRelevant(title, keywords)) {
        console.log(`[youtube] filtered by relevance: "${title}"`);
        continue;
      }

      const embeddable = await checkEmbeddable(item.id);

      validated.push({
        id: item.id,
        title,
        channelName: item.channelTitle || item.shortBylineText?.runs?.[0]?.text || "Desconocido",
        thumbnailUrl: item.thumbnail?.thumbnails?.at(-1)?.url || "",
        duration: item.length?.simpleText || "",
        embeddable,
      });

      if (validated.length >= maxResults) break;
    }

    if (validated.length === 0 && candidates.length > 0) {
      console.warn("[youtube] no relevant matches, falling back to raw candidates");
      for (const item of candidates.slice(0, maxResults)) {
        const embeddable = await checkEmbeddable(item.id);
        validated.push({
          id: item.id,
          title: item.title || "Sin título",
          channelName: item.channelTitle || item.shortBylineText?.runs?.[0]?.text || "Desconocido",
          thumbnailUrl: item.thumbnail?.thumbnails?.at(-1)?.url || "",
          duration: item.length?.simpleText || "",
          embeddable,
        });
      }
    }

    console.log(`[youtube] final validated videos: ${validated.length}`);
    return validated;
  } catch (error) {
    console.error("[youtube] search failed:", error);
    return [];
  }
}
