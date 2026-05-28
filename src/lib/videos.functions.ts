import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function sendVideoNoteToChat(opts: {
  botToken: string | null | undefined;
  chatId: number | string;
  fileBytes: ArrayBuffer;
  filename: string;
  mimeType: string;
  duration?: number | null;
}) {
  if (!opts.botToken) {
    return { ok: false, description: "Conta sem bot_token" } as { ok: boolean; result?: { message_id: number }; description?: string };
  }
  const form = new FormData();
  form.append("chat_id", String(opts.chatId));
  if (opts.duration) form.append("duration", String(opts.duration));
  form.append(
    "video_note",
    new Blob([opts.fileBytes], { type: opts.mimeType || "video/mp4" }),
    opts.filename,
  );
  const res = await fetch(`https://api.telegram.org/bot${opts.botToken}/sendVideoNote`, {
    method: "POST",
    body: form,
  });
  return (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
}

async function sendVideoToChat(opts: {
  botToken: string | null | undefined;
  chatId: number | string;
  fileBytes: ArrayBuffer;
  filename: string;
  mimeType: string;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
  parseMode?: string | null;
  replyMarkup?: unknown;
}) {
  if (!opts.botToken) {
    return { ok: false, description: "Conta sem bot_token" } as { ok: boolean; result?: { message_id: number }; description?: string };
  }
  const form = new FormData();
  form.append("chat_id", String(opts.chatId));
  if (opts.caption && opts.caption.trim()) {
    form.append("caption", opts.caption);
    if (opts.parseMode) form.append("parse_mode", opts.parseMode);
  }
  if (opts.duration) form.append("duration", String(Math.round(opts.duration)));
  if (opts.width) form.append("width", String(Math.round(opts.width)));
  if (opts.height) form.append("height", String(Math.round(opts.height)));
  form.append("supports_streaming", "true");
  if (opts.replyMarkup) form.append("reply_markup", JSON.stringify(opts.replyMarkup));
  form.append(
    "video",
    new Blob([opts.fileBytes], { type: opts.mimeType || "video/mp4" }),
    opts.filename,
  );
  const res = await fetch(`https://api.telegram.org/bot${opts.botToken}/sendVideo`, {
    method: "POST",
    body: form,
  });
  return (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
}

export const sendVideoNoteNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      videoId: z.string().uuid(),
      accountId: z.string().uuid(),
      chatIds: z.array(z.union([z.number(), z.string()])).min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: video, error: vErr } = await supabase
      .from("videos")
      .select("id, storage_path, mime_type, duration_seconds, title, kind, width, height")
      .eq("id", data.videoId)
      .maybeSingle();
    if (vErr || !video) throw new Error("Vídeo não encontrado");

    const { data: acc, error: aErr } = await supabase
      .from("telegram_accounts")
      .select("id, bot_token")
      .eq("id", data.accountId)
      .maybeSingle();
    if (aErr || !acc) throw new Error("Conta Telegram não encontrada");

    const { data: file, error: dErr } = await supabaseAdmin.storage
      .from("videos")
      .download(video.storage_path);
    if (dErr || !file) throw new Error("Falha ao baixar vídeo: " + (dErr?.message ?? ""));
    const bytes = await file.arrayBuffer();

    const results: { chatId: string | number; ok: boolean; error?: string }[] = [];
    for (const chatId of data.chatIds) {
      const sender = (video as any).kind === "normal" ? sendVideoToChat : sendVideoNoteToChat;
      const r = await sender({
        botToken: acc.bot_token,
        chatId,
        fileBytes: bytes,
        filename: video.title.replace(/[^\w.-]+/g, "_") + ".mp4",
        mimeType: video.mime_type ?? "video/mp4",
        duration: video.duration_seconds,
        width: (video as { width?: number | null }).width,
        height: (video as { height?: number | null }).height,
      });
      await supabaseAdmin.from("message_logs").insert({
        user_id: userId,
        account_id: data.accountId,
        chat_id: typeof chatId === "string" ? Number(chatId) : chatId,
        ok: r.ok,
        telegram_message_id: r.result?.message_id ?? null,
        error: r.ok ? null : r.description ?? "erro",
      } as never);
      results.push({ chatId, ok: r.ok, error: r.ok ? undefined : r.description });
    }
    return { results };
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: v } = await supabase
      .from("videos")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (v?.storage_path) {
      await supabaseAdmin.storage.from("videos").remove([v.storage_path]);
    }
    const { error } = await supabase.from("videos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Helper used by the scheduler dispatcher (admin context)
export async function dispatchVideoNote(opts: {
  botToken: string | null | undefined;
  storagePath: string;
  chatId: number;
  duration?: number | null;
  mimeType?: string | null;
  filename?: string;
}): Promise<{ ok: boolean; result?: { message_id: number }; description?: string }> {
  const { data: file, error } = await supabaseAdmin.storage
    .from("videos")
    .download(opts.storagePath);
  if (error || !file) {
    return { ok: false, description: "Falha ao baixar vídeo" };
  }
  const bytes = await file.arrayBuffer();
  return sendVideoNoteToChat({
    botToken: opts.botToken,
    chatId: opts.chatId,
    fileBytes: bytes,
    filename: opts.filename ?? "video.mp4",
    mimeType: opts.mimeType ?? "video/mp4",
    duration: opts.duration,
  });
}

export async function dispatchVideo(opts: {
  botToken: string | null | undefined;
  storagePath: string;
  chatId: number;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  filename?: string;
  caption?: string | null;
  parseMode?: string | null;
  replyMarkup?: unknown;
}): Promise<{ ok: boolean; result?: { message_id: number }; description?: string }> {
  const { data: file, error } = await supabaseAdmin.storage
    .from("videos")
    .download(opts.storagePath);
  if (error || !file) {
    return { ok: false, description: "Falha ao baixar vídeo" };
  }
  const bytes = await file.arrayBuffer();
  return sendVideoToChat({
    botToken: opts.botToken,
    chatId: opts.chatId,
    fileBytes: bytes,
    filename: opts.filename ?? "video.mp4",
    mimeType: opts.mimeType ?? "video/mp4",
    duration: opts.duration,
    width: opts.width,
    height: opts.height,
    caption: opts.caption,
    parseMode: opts.parseMode,
    replyMarkup: opts.replyMarkup,
  });
}