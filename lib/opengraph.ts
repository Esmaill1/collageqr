import type { TrackMetadata } from "@/lib/feed";

/**
 * Server-side track metadata extraction for the Desk Cassette (PRD §3.3 P1).
 *
 * Fetches the track page HTML with a desktop User-Agent (music providers
 * serve richer og: tags to desktop clients) and regex-extracts OpenGraph
 * tags. Deliberately dependency-free (fetch + regex) — no headless browser
 * and no provider APIs.
 *
 * Best-effort contract: many providers embed og:title as "Song Name - Artist",
 * which we split on the first " - " occurrence. Some providers block server
 * fetches (403 / bot walls) or need provider APIs for reliable metadata —
 * when that happens we return nulls and the UI falls back to the raw URL.
 * Acceptable for MVP (Plan §6 risk mitigation).
 */

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 4000;
const MAX_HTML_BYTES = 300_000;

/**
 * SSRF guard: metadata is only ever fetched from known music providers.
 * Hostnames are matched by suffix so provider subdomains (e.g.
 * open.spotify.com, youtu.be-adjacent hosts) are accepted while arbitrary
 * user-supplied hosts — including internal/private targets — are refused.
 */
const ALLOWED_HOST_SUFFIXES = [
  "spotify.com",
  "soundcloud.com",
  "youtube.com",
  "youtube.googleapis.com",
  "music.youtube.com",
  "anghami.com",
] as const;

/** Hard cap on redirect hops; every hop is re-checked against the allowlist. */
const MAX_REDIRECT_HOPS = 2;

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/**
 * Fetch a response with redirects disabled and re-validated: each hop must
 * be an allowed provider host, and at most MAX_REDIRECT_HOPS redirects are
 * followed (with `redirect: "manual"` so fetch never chases an arbitrary
 * Location itself). Returns null when a hop is refused or exhausted.
 */
async function fetchWithCheckedRedirects(url: string): Promise<Response | null> {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!isAllowedHost(parsed.hostname)) return null;

    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": DESKTOP_USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      try {
        currentUrl = new URL(location, parsed).toString();
      } catch {
        return null;
      }
      continue;
    }
    return res;
  }
  return null; // redirect cap exceeded
}

/**
 * Stream the response body and stop as soon as the byte cap is exceeded,
 * so a large or slow-drip body can never buffer unboundedly in memory.
 * Throws when the cap is exceeded (caller maps that to empty metadata).
 */
async function readCappedText(res: Response): Promise<string> {
  const body = res.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > MAX_HTML_BYTES) throw new Error("response-body-too-large");
        html += decoder.decode(value, { stream: true });
      }
    }
    html += decoder.decode();
    return html;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // stream already closed
    }
  }
}

/** Match `<meta property="og:title" content="...">` (property/name, either attribute order). */
function extractOgTag(html: string, tag: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${tag}["'][^>]+content=["']([^"']*)["']` +
      `|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${tag}["']`,
    "i",
  );
  const match = pattern.exec(html);
  if (!match) return null;
  const value = (match[1] ?? match[2] ?? "").trim();
  return value.length > 0 ? value : null;
}

/** Decode the handful of HTML entities that commonly appear in og: content. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'");
}

export function isValidTrackUrl(trackUrl: string): boolean {
  return /^https?:\/\/\S+$/i.test(trackUrl.trim());
}

/** Split "Song Name - Artist" (shared separator across most providers). */
function splitTitleArtist(ogTitle: string): { title: string; artist: string | null } {
  const idx = ogTitle.indexOf(" - ");
  if (idx > 0 && idx < ogTitle.length - 3) {
    const artist = ogTitle.slice(idx + 3).trim();
    const title = ogTitle.slice(0, idx).trim();
    if (title) return { title, artist: artist || null };
  }
  // Some embeds use "Song by Artist on SassyService".
  const byMatch = /^(.{1,200}?)\s+by\s+(.+?)(?:\s+on\s+.+)?$/i.exec(ogTitle);
  if (byMatch && byMatch[1] && byMatch[2]) {
    return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
  }
  return { title: ogTitle, artist: null };
}

export async function fetchTrackMetadata(url: string): Promise<TrackMetadata> {
  const empty: TrackMetadata = { title: null, artist: null, imageUrl: null };

  if (!isValidTrackUrl(url)) return empty;

  try {
    const res = await fetchWithCheckedRedirects(url);
    if (!res || !res.ok) return empty;

    const text = (await readCappedText(res)).slice(0, MAX_HTML_BYTES);

    const ogTitle = extractOgTag(text, "og:title");
    if (!ogTitle) return empty;

    const desc = extractOgTag(text, "og:description");
    const ogImage = extractOgTag(text, "og:image");
    const { title, artist } = splitTitleArtist(decodeEntities(ogTitle));

    // og:description sometimes holds "Song by Artist · Album" when og:title
    // is generic; site_name tells us which service but is rarely the artist.
    let resolvedArtist = artist;
    if (!resolvedArtist && desc) {
      const byMatch = /\bby\s+([^·&/]{1,60})/i.exec(decodeEntities(desc));
      if (byMatch?.[1]) resolvedArtist = byMatch[1].trim();
    }

    return {
      title,
      artist: resolvedArtist ?? null,
      imageUrl: ogImage ? decodeEntities(ogImage) : null,
    };
  } catch {
    // Blocked, timed out, offline, or garbage HTML → fall back to raw URL.
    return empty;
  }
}
