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

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);
}

function isRelevant(title: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lower = title.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

async function checkEmbeddable(id: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { signal: AbortSignal.timeout(3000) }
    );
    return res.ok;
  } catch {
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
  subject: string,
  maxResults = 3
): Promise<YouTubeVideo[]> {
  try {
    const searchTerms = [
      `${query} ${subject} ejercicios`,
      `${query} ejercicios resueltos`,
      `${query} tutorial`,
    ];

    const { GetListByKeyword } = await import("youtube-search-api");

    const allItems: YouTubeSearchItem[] = [];
    for (const term of searchTerms) {
      if (allItems.length >= maxResults * 2) break;
      try {
        const result = await GetListByKeyword(term, false, maxResults);
        if (result?.items) {
          allItems.push(...(result.items as YouTubeSearchItem[]));
        }
      } catch {
        // Continue with next search term
      }
    }

    const seen = new Set<string>();
    const keywords = extractKeywords(query);

    const candidates = allItems
      .filter((item) => item.type === "video" && !seen.has(item.id) && seen.add(item.id))
      .slice(0, maxResults * 2);

    const validated: YouTubeVideo[] = [];
    for (const item of candidates) {
      const title = item.title || "Sin título";
      if (!isRelevant(title, keywords)) continue;

      const embeddable = await checkEmbeddable(item.id);
      if (!embeddable) continue;

      validated.push({
        id: item.id,
        title,
        channelName: item.channelTitle || item.shortBylineText?.runs?.[0]?.text || "Desconocido",
        thumbnailUrl: item.thumbnail?.thumbnails?.at(-1)?.url || "",
        duration: item.length?.simpleText || "",
        embeddable: true,
      });

      if (validated.length >= maxResults) break;
    }

    return validated;
  } catch (error) {
    console.error("[youtube] search failed:", error);
    return [];
  }
}
