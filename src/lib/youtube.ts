export interface YouTubeVideo {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: string;
}

export function buildSearchUrl(query: string): string {
  const q = encodeURIComponent(`${query} tutorial ejercicios`);
  return `https://www.youtube.com/results?search_query=${q}`;
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

export async function searchYouTubeVideos(query: string, maxResults = 2): Promise<YouTubeVideo[]> {
  try {
    const { GetListByKeyword } = await import("youtube-search-api");
    const result = await GetListByKeyword(
      `${query} tutorial ejercicios`,
      false,
      maxResults
    );

    if (!result?.items?.length) return [];

    return (result.items as YouTubeSearchItem[])
      .filter((item) => item.type === "video")
      .slice(0, maxResults)
      .map((item) => ({
        id: item.id,
        title: item.title || "Sin título",
        channelName: item.channelTitle || item.shortBylineText?.runs?.[0]?.text || "Desconocido",
        thumbnailUrl: item.thumbnail?.thumbnails?.at(-1)?.url || "",
        duration: item.length?.simpleText || "",
      }));
  } catch (error) {
    console.error("[youtube] search failed:", error);
    return [];
  }
}
