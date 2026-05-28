import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { sendTextWithPremiumEmojis, sendPhotoWithPremiumEmojiCaption } from "@/lib/premium-send.server";
import { dispatchVideo, dispatchVideoNote } from "@/lib/videos.functions";

// ╔══════════════════════════════════════════════════════════╗
// ║  CRON: DISPATCH-FOLLOWUPS (executado a cada minuto)      ║
// ║  Envia mensagens diárias no privado dos leads inscritos  ║
// ║  no Bot Follow-Up. Inclui dedupe, stop por bloqueio e    ║
// ║  marca lead como "completed" ao fim da sequência.        ║
// ╚══════════════════════════════════════════════════════════╝

function publicUrl(bucket: string, path: string): string {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function nowInTimezone(tz: string): { hhmm: string; minutes: number; ymd: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const h = parseInt(parts.hour ?? "0", 10);
  const m = parseInt(parts.minute ?? "0", 10);
  return {
    hhmm: `${parts.hour}:${parts.minute}`,
    minutes: h * 60 + m,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function daysBetweenInTimezone(startIso: string, tz: string): number {
  const start = nowInTimezone(tz);
  // Get start_date in tz
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const startParts = Object.fromEntries(
    fmt.formatToParts(new Date(startIso)).map((p) => [p.type, p.value]),
  );
  const startYmd = `${startParts.year}-${startParts.month}-${startParts.day}`;
  const d1 = new Date(startYmd + "T00:00:00Z").getTime();
  const d2 = new Date(start.ymd + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

type LeadRow = {
  id: string;
  user_id: string;
  room_id: string;
  account_id: string;
  chat_id: number;
  tg_user_id: number;
  first_name: string | null;
  username: string | null;
  started_at: string;
  status: string;
};

type MsgRow = {
  id: string;
  day_number: number;
  send_time: string;
  content: string | null;
  image_path: string | null;
  video_id: string | null;
  parse_mode: string;
  premium_enabled: boolean;
  premium_account_id: string | null;
  button_text: string | null;
  button_url: string | null;
};

async function dispatchOne(opts: {
  lead: LeadRow;
  msg: MsgRow;
  botToken: string;
}): Promise<{ ok: boolean; error?: string; blocked?: boolean }> {
  const { lead, msg, botToken } = opts;
  const firstName = (lead.first_name ?? "amigo(a)").replace(/[<>&]/g, "");
  const mention = `<a href="tg://user?id=${lead.tg_user_id}">${firstName}</a>`;
  const text = renderTemplate(msg.content ?? "", {
    name: mention,
    first_name: firstName,
    username: lead.username ?? "",
  });
  const parse_mode = msg.parse_mode || "HTML";
  const reply_markup =
    msg.button_text && msg.button_url
      ? { inline_keyboard: [[{ text: msg.button_text, url: msg.button_url }]] }
      : undefined;

  const isBlocked = (d?: string) =>
    !!d && /blocked|user is deactivated|chat not found|bot was kicked/i.test(d);

  // Video
  if (msg.video_id) {
    const { data: vid } = await supabaseAdmin
      .from("videos")
      .select("storage_path, kind, mime_type, duration_seconds, title, width, height")
      .eq("id", msg.video_id)
      .maybeSingle();
    if (vid?.storage_path) {
      const isRound = vid.kind === "round";
      const resp = isRound
        ? await dispatchVideoNote({
            botToken,
            storagePath: vid.storage_path,
            chatId: lead.chat_id,
            duration: vid.duration_seconds,
            width: (vid as { width?: number | null }).width,
            height: (vid as { height?: number | null }).height,
            mimeType: vid.mime_type,
            filename: (vid.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
          })
        : await dispatchVideo({
            botToken,
            storagePath: vid.storage_path,
            chatId: lead.chat_id,
            duration: vid.duration_seconds,
            mimeType: vid.mime_type,
            filename: (vid.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
            caption: text || null,
            parseMode: parse_mode,
            replyMarkup: undefined,
          });
      if (!resp.ok) return { ok: false, error: resp.description, blocked: isBlocked(resp.description) };
      if (isRound && text) {
        await callTelegram(botToken, "sendMessage", {
          chat_id: lead.chat_id,
          text,
          parse_mode,
          reply_markup,
        });
      } else if (reply_markup) {
        await callTelegram(botToken, "sendMessage", { chat_id: lead.chat_id, text: "\u2063", reply_markup });
      }
      return { ok: true };
    }
  }

  // Photo
  if (msg.image_path) {
    const url = publicUrl("room-images", msg.image_path);
    if (msg.premium_enabled && msg.premium_account_id) {
      const r = await sendPhotoWithPremiumEmojiCaption({
        userId: lead.user_id,
        accountId: msg.premium_account_id,
        chatId: lead.chat_id,
        photoUrl: url,
        caption: text || null,
        strict: false,
      }).catch((e) => ({ applied: true as const, ok: false as const, error: e instanceof Error ? e.message : String(e) }));
      if (r.applied && r.ok) {
        if (reply_markup) {
          await callTelegram(botToken, "sendMessage", { chat_id: lead.chat_id, text: "\u2063", reply_markup });
        }
        return { ok: true };
      }
    }
    const resp = await callTelegram(botToken, "sendPhoto", {
      chat_id: lead.chat_id,
      photo: url,
      caption: text || undefined,
      parse_mode: text ? parse_mode : undefined,
      reply_markup,
    });
    if (!resp.ok) return { ok: false, error: resp.description, blocked: isBlocked(resp.description) };
    return { ok: true };
  }

  // Text
  if (msg.premium_enabled && msg.premium_account_id && text) {
    const r = await sendTextWithPremiumEmojis({
      userId: lead.user_id,
      accountId: msg.premium_account_id,
      chatId: lead.chat_id,
      text,
      allowPlain: true,
    }).catch((e) => ({ applied: true as const, ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    if (r.applied && r.ok) {
      if (reply_markup) {
        await callTelegram(botToken, "sendMessage", { chat_id: lead.chat_id, text: "\u2063", reply_markup });
      }
      return { ok: true };
    }
  }

  const resp = await callTelegram(botToken, "sendMessage", {
    chat_id: lead.chat_id,
    text: text || "(sem conteúdo)",
    parse_mode,
    reply_markup,
    disable_web_page_preview: true,
  });
  if (!resp.ok) return { ok: false, error: resp.description, blocked: isBlocked(resp.description) };
  return { ok: true };
}

async function runDispatch(): Promise<{ checked: number; sent: number; failed: number; stopped: number }> {
  let checked = 0;
  let sent = 0;
  let failed = 0;
  let stopped = 0;

  // Pull all active leads (limit batch)
  const { data: leads } = await supabaseAdmin
    .from("followup_leads" as never)
    .select("*")
    .eq("status", "active")
    .limit(500);
  const leadList = (leads as LeadRow[] | null) ?? [];
  if (!leadList.length) return { checked, sent, failed, stopped };

  // Group by room_id
  const roomIds = Array.from(new Set(leadList.map((l) => l.room_id)));

  const { data: settings } = await supabaseAdmin
    .from("followup_settings" as never)
    .select("room_id, enabled, timezone")
    .in("room_id", roomIds);
  const settingsByRoom = new Map<string, { enabled: boolean; timezone: string }>();
  for (const s of (settings as { room_id: string; enabled: boolean; timezone: string }[] | null) ?? []) {
    settingsByRoom.set(s.room_id, { enabled: s.enabled, timezone: s.timezone });
  }

  const { data: messages } = await supabaseAdmin
    .from("followup_messages" as never)
    .select("*")
    .in("room_id", roomIds);
  const msgsByRoom = new Map<string, MsgRow[]>();
  for (const m of (messages as (MsgRow & { room_id: string })[] | null) ?? []) {
    const list = msgsByRoom.get(m.room_id) ?? [];
    list.push(m);
    msgsByRoom.set(m.room_id, list);
  }

  const accountIds = Array.from(new Set(leadList.map((l) => l.account_id)));
  const { data: accounts } = await supabaseAdmin
    .from("telegram_accounts")
    .select("id, bot_token")
    .in("id", accountIds);
  const tokenByAcc = new Map<string, string | null>();
  for (const a of accounts ?? []) tokenByAcc.set(a.id, a.bot_token);

  for (const lead of leadList) {
    checked++;
    const cfg = settingsByRoom.get(lead.room_id);
    if (!cfg?.enabled) continue;
    const msgs = msgsByRoom.get(lead.room_id) ?? [];
    if (!msgs.length) continue;
    const maxDay = Math.max(...msgs.map((m) => m.day_number));
    const tz = cfg.timezone || "America/Sao_Paulo";
    const dayIdx = daysBetweenInTimezone(lead.started_at, tz) + 1; // dia 1 no primeiro dia

    if (dayIdx > maxDay) {
      await supabaseAdmin
        .from("followup_leads" as never)
        .update({ status: "completed" } as never)
        .eq("id", lead.id);
      continue;
    }

    const msg = msgs.find((m) => m.day_number === dayIdx);
    if (!msg) continue;

    const now = nowInTimezone(tz);
    const [sh, sm] = (msg.send_time || "09:00").split(":");
    const target = parseInt(sh, 10) * 60 + parseInt(sm, 10);
    if (now.minutes < target) continue;

    // Dedup
    const { data: existing } = await supabaseAdmin
      .from("followup_dispatch_log" as never)
      .select("id")
      .eq("lead_id", lead.id)
      .eq("day_number", dayIdx)
      .maybeSingle();
    if (existing) continue;

    const token = tokenByAcc.get(lead.account_id);
    if (!token) continue;

    const res = await dispatchOne({ lead, msg, botToken: token });

    await supabaseAdmin.from("followup_dispatch_log" as never).insert({
      user_id: lead.user_id,
      lead_id: lead.id,
      day_number: dayIdx,
      ok: res.ok,
      error: res.ok ? null : (res.error ?? "erro"),
    } as never);

    if (res.ok) {
      sent++;
      await supabaseAdmin
        .from("followup_leads" as never)
        .update({ last_sent_day: dayIdx, last_sent_at: new Date().toISOString() } as never)
        .eq("id", lead.id);
    } else {
      failed++;
      if (res.blocked) {
        stopped++;
        await supabaseAdmin
          .from("followup_leads" as never)
          .update({
            status: "stopped",
            stopped_at: new Date().toISOString(),
            stopped_reason: res.error ?? "blocked",
          } as never)
          .eq("id", lead.id);
      }
    }
  }

  return { checked, sent, failed, stopped };
}

export const Route = createFileRoute("/api/public/cron/dispatch-followups")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runDispatch();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[dispatch-followups] error:", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }
      },
      GET: async () => {
        try {
          const result = await runDispatch();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }
      },
    },
  },
});