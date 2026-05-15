import { describe, it, expect } from "vitest";
import {
  hasEmojiTokens,
  renderEmojiTokens,
  renderEmojiTokensToHtml,
  type EmojiLookup,
} from "@/lib/premium-emoji-render";

const lookup: EmojiLookup = new Map([
  ["FIRE", { custom_emoji_id: "5301311662836492845", preview_char: "🔥" }],
  ["STAR", { custom_emoji_id: "5300120962641196712", preview_char: "⭐" }],
]);

describe("HTML rendering — Bot API", () => {
  it("preserva tags <b>/<i>/<u> ao redor de tokens", () => {
    const { text, replaced } = renderEmojiTokensToHtml(
      "<b>Sinal {FIRE}</b> entra agora <i>{STAR}</i>",
      lookup,
    );
    expect(replaced).toBe(true);
    expect(text).toBe(
      '<b>Sinal <tg-emoji emoji-id="5301311662836492845">🔥</tg-emoji></b> entra agora <i><tg-emoji emoji-id="5300120962641196712">⭐</tg-emoji></i>',
    );
  });

  it("token desconhecido permanece literal sem quebrar HTML", () => {
    const { text, replaced } = renderEmojiTokensToHtml(
      "<b>{NAO_EXISTE}</b> e <b>{FIRE}</b>",
      lookup,
    );
    expect(replaced).toBe(true);
    expect(text).toBe(
      '<b>{NAO_EXISTE}</b> e <b><tg-emoji emoji-id="5301311662836492845">🔥</tg-emoji></b>',
    );
  });

  it("texto sem tokens não é alterado", () => {
    const { text, replaced } = renderEmojiTokensToHtml("<b>Negrito</b> normal", lookup);
    expect(replaced).toBe(false);
    expect(text).toBe("<b>Negrito</b> normal");
  });

  it("hasEmojiTokens detecta tokens corretamente", () => {
    expect(hasEmojiTokens("oi {FIRE}")).toBe(true);
    expect(hasEmojiTokens("nada aqui")).toBe(false);
    expect(hasEmojiTokens("")).toBe(false);
    expect(hasEmojiTokens(null)).toBe(false);
  });
});

describe("MTProto entities — offsets UTF-16", () => {
  it("substitui token por preview_char e devolve entity com offset/length corretos", () => {
    const { text, entities } = renderEmojiTokens("Olá {FIRE}!", lookup);
    expect(text).toBe("Olá 🔥!");
    expect(entities).toHaveLength(1);
    expect(entities[0].documentId).toBe("5301311662836492845");
    // "🔥" ocupa 2 unidades UTF-16
    expect(entities[0].length).toBe(2);
    // offset = comprimento de "Olá "
    expect(entities[0].offset).toBe("Olá ".length);
    expect(text.slice(entities[0].offset, entities[0].offset + entities[0].length)).toBe("🔥");
  });

  it("nome case-insensitive funciona", () => {
    const { entities } = renderEmojiTokens("{fire} {Star}", lookup);
    expect(entities.map((e) => e.documentId)).toEqual([
      "5301311662836492845",
      "5300120962641196712",
    ]);
  });

  it("mantém múltiplos tokens com offsets sequenciais corretos", () => {
    const { text, entities } = renderEmojiTokens("a {FIRE} b {STAR} c", lookup);
    expect(text).toBe("a 🔥 b ⭐ c");
    expect(entities).toHaveLength(2);
    expect(text.slice(entities[0].offset, entities[0].offset + entities[0].length)).toBe("🔥");
    expect(text.slice(entities[1].offset, entities[1].offset + entities[1].length)).toBe("⭐");
  });
});