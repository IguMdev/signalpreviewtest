// Fetcher de manchetes para o cartão "Dicas de Mercado".
// Fontes RSS em pt-BR — categorias forex e crypto.
// Sem dependências externas: parsing manual de RSS/Atom.

export type TipCategory = "forex" | "crypto";

export type MarketTip = {
  category: TipCategory;
  title: string;
  link: string;
  description: string;
  image: string | null;
  publishedAt: number; // epoch ms
  source: string;
};

const FEEDS: Record<TipCategory, { url: string; source: string }[]> = {
  forex: [
    { url: "https://br.investing.com/rss/news_1.rss", source: "Investing.com" },
    { url: "https://br.investing.com/rss/news_285.rss", source: "Investing.com Forex" },
    { url: "https://www.infomoney.com.br/mercados/cambio/feed/", source: "InfoMoney" },
  ],
  crypto: [
    { url: "https://br.cointelegraph.com/rss", source: "Cointelegraph BR" },
    { url: "https://livecoins.com.br/feed/", source: "Livecoins" },
    { url: "https://www.infomoney.com.br/mercados/criptomoedas/feed/", source: "InfoMoney Cripto" },
  ],
};

function pick<T>(re: RegExp, src: string): string | null {
  const m = src.match(re);
  return m ? m[1].trim() : null;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .trim();
}

function extractImage(itemXml: string): string | null {
  // tenta <enclosure url="..." type="image/...">
  const enc = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i);
  if (enc && /image\/|\.(jpg|jpeg|png|webp)/i.test(enc[0])) return enc[1];
  // <media:content url="...">
  const media = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (media) return media[1];
  // <media:thumbnail url="...">
  const thumb = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (thumb) return thumb[1];
  // primeira <img src="..."> em description/content
  const img = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img) return img[1];
  return null;
}

function parseRss(xml: string, source: string, category: TipCategory): MarketTip[] {
  const items: MarketTip[] = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRe) ?? [];
  for (const raw of matches) {
    const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, raw);
    const link = pick(/<link[^>]*>([\s\S]*?)<\/link>/i, raw);
    const desc =
      pick(/<description[^>]*>([\s\S]*?)<\/description>/i, raw) ??
      pick(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i, raw) ??
      "";
    const pubDate = pick(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i, raw);
    if (!title || !link) continue;
    const cleanLink = decode(link);
    items.push({
      category,
      title: decode(title),
      link: cleanLink,
      description: decode(desc).slice(0, 280),
      image: extractImage(raw),
      publishedAt: pubDate ? Date.parse(pubDate) || Date.now() : Date.now(),
      source,
    });
  }
  return items;
}

async function fetchFeed(url: string, source: string, category: TipCategory): Promise<MarketTip[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LovableMarketTips/1.0; +https://lovable.app)",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return parseRss(await res.text(), source, category);
  } catch {
    return [];
  }
}

/** Busca manchetes recentes para as categorias pedidas. */
export async function fetchMarketTips(categories: TipCategory[]): Promise<MarketTip[]> {
  const jobs: Promise<MarketTip[]>[] = [];
  for (const cat of categories) {
    for (const f of FEEDS[cat] ?? []) jobs.push(fetchFeed(f.url, f.source, cat));
  }
  const all = (await Promise.all(jobs)).flat();
  // ordena por mais recente
  all.sort((a, b) => b.publishedAt - a.publishedAt);
  return all;
}

/** Hash estável e curto de um link, para deduplicar entre disparos. */
export async function linkHash(link: string): Promise<string> {
  const data = new TextEncoder().encode(link.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 16; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

/** Monta o texto HTML enviado ao Telegram para uma manchete. */
export function formatTipMessage(tip: MarketTip): string {
  const flag = tip.category === "crypto" ? "🪙" : "💱";
  const lines = [
    `${flag} <b>${escapeHtml(tip.title)}</b>`,
  ];
  if (tip.description) lines.push("", escapeHtml(tip.description));
  lines.push("", `<i>${escapeHtml(tip.source)}</i> — <a href="${escapeAttr(tip.link)}">Ler matéria</a>`);
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}