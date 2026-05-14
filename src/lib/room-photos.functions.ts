import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callTelegram } from "./telegram.server";

type ChatPhoto = { small_file_id: string; big_file_id: string };
type ChatInfo = { id: number; title?: string; photo?: ChatPhoto };
type FileInfo = { file_id: string; file_path?: string };

export const syncRoomPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: room } = await supabase
      .from("rooms")
      .select("id, default_account_id")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Sala não encontrada");

    const { data: chats } = await supabase
      .from("room_chats")
      .select("chat_id")
      .eq("room_id", data.roomId)
      .limit(1);
    const chat = chats?.[0];
    if (!chat) throw new Error("Esta sala ainda não tem grupo vinculado");

    let accountId = room.default_account_id;
    if (!accountId) {
      const { data: anyAcc } = await supabase
        .from("telegram_accounts")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      accountId = anyAcc?.id ?? null;
    }
    if (!accountId) throw new Error("Nenhuma conta Telegram disponível");

    const { data: acc } = await supabase
      .from("telegram_accounts")
      .select("bot_token")
      .eq("id", accountId)
      .maybeSingle();
    if (!acc?.bot_token) throw new Error("Conta sem token");

    const info = await callTelegram<ChatInfo>(acc.bot_token, "getChat", {
      chat_id: chat.chat_id,
    });
    if (!info.ok || !info.result) {
      const desc = info.description ?? "Falha ao consultar grupo";
      return { ok: false, photoUrl: null, message: desc } as const;
    }
    if (!info.result.photo) {
      await supabase
        .from("rooms")
        .update({ photo_url: null, photo_updated_at: new Date().toISOString() })
        .eq("id", data.roomId);
      return { ok: true, photoUrl: null, message: "Grupo sem foto" };
    }

    const fileId = info.result.photo.big_file_id;
    const f = await callTelegram<FileInfo>(acc.bot_token, "getFile", {
      file_id: fileId,
    });
    if (!f.ok || !f.result?.file_path) {
      throw new Error(f.description ?? "Falha ao obter arquivo");
    }

    const dl = await fetch(
      `https://api.telegram.org/file/bot${acc.bot_token}/${f.result.file_path}`,
    );
    if (!dl.ok) throw new Error(`Download falhou (${dl.status})`);
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const ext = f.result.file_path.split(".").pop()?.toLowerCase() || "jpg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";
    const path = `${userId}/${data.roomId}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("room-photos")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = supabase.storage.from("room-photos").getPublicUrl(path);
    const photoUrl = pub.publicUrl;

    await supabase
      .from("rooms")
      .update({ photo_url: photoUrl, photo_updated_at: new Date().toISOString() })
      .eq("id", data.roomId);

    return { ok: true, photoUrl };
  });
