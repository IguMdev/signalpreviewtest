// Helpers para tokens de emoji premium no formato {NOME}.
// Sem dependências de runtime — pode rodar em qualquer ambiente.

export function hasEmojiTokens(s: string | null | undefined): boolean {
  if (!s) return false;
  return /\{[^}]+\}/.test(s);
}

export type RenderedEntity = {
  name: string;
  offset: number;
  length: number;
  documentId: string;
};

export type EmojiLookup = Map<
  string,
  { custom_emoji_id: string; preview_char: string | null }
>;

/**
 * Substitui {NOME} pelo `preview_char` (ou ⭐ como fallback)
 * e devolve as entities `MessageEntityCustomEmoji` com offsets em UTF-16
 * (compatível com a API do Telegram / GramJS).
 */
export function renderEmojiTokens(
  text: string,
  lookup: EmojiLookup,
): { text: string; entities: RenderedEntity[] } {
  const normalizedLookup = new Map(
    Array.from(lookup.entries()).map(([name, value]) => [name.trim().toUpperCase(), value]),
  );
  const entities: RenderedEntity[] = [];
  const re = /\{([A-Za-z0-9_\-]+)\}/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out += text.slice(last, m.index);
    const name = m[1].trim();
    const found = lookup.get(name) ?? normalizedLookup.get(name.toUpperCase());
    if (!found) {
      out += m[0];
      last = m.index + m[0].length;
      continue;
    }
    const replacement =
      found.preview_char && found.preview_char.length > 0
        ? found.preview_char
        : "⭐";
    // Strings JS já estão em UTF-16, então .length = unidades de código.
    entities.push({
      name,
      offset: out.length,
      length: replacement.length,
      documentId: found.custom_emoji_id,
    });
    out += replacement;
    last = m.index + m[0].length;
  }
  out += text.slice(last);
  return { text: out, entities };
}

/**
 * Renderiza os mesmos tokens no formato HTML aceito pelo Telegram Bot API.
 * Mantém o restante do texto intacto para não quebrar templates que já usam HTML.
 */
export function renderEmojiTokensToHtml(
  text: string,
  lookup: EmojiLookup,
): { text: string; replaced: boolean } {
  const normalizedLookup = new Map(
    Array.from(lookup.entries()).map(([name, value]) => [name.trim().toUpperCase(), value]),
  );
  let replaced = false;
  const out = text.replace(/\{([A-Za-z0-9_\-]+)\}/g, (token, rawName: string) => {
    const name = rawName.trim();
    const found = lookup.get(name) ?? normalizedLookup.get(name.toUpperCase());
    if (!found) return token;
    replaced = true;
    const fallback = found.preview_char && found.preview_char.length > 0 ? found.preview_char : "⭐";
    return `<tg-emoji emoji-id="${found.custom_emoji_id}">${fallback}</tg-emoji>`;
  });
  return { text: out, replaced };
}