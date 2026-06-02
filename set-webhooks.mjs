import crypto from "crypto";

const bots = [
  {
    token: "8921132295:AAGjjnF-70a8cDR_4tXZGhlaztcgnD0vxF4",
    accountId: "acc56428-1cb3-4663-b2d4-f61922b992e5",
  },
  {
    token: "8314307766:AAGPUelWT6EYtl_dKMxBM_NzrrhlIvP0S7I",
    accountId: "580e6ce9-2e6a-4da4-b7cb-cef11e42843c",
  },
];

const BASE_URL = "https://telesignal.com.br";
const ALLOWED = ["message", "channel_post", "my_chat_member", "chat_member"];

async function setWebhook(bot) {
  const secretToken = crypto
    .createHash("sha256")
    .update(`tg-tracking:${bot.token}`)
    .digest("base64url");

  const webhookUrl = `${BASE_URL}/api/public/telegram/webhook/${bot.accountId}`;

  const res = await fetch(
    `https://api.telegram.org/bot${bot.token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ALLOWED,
        secret_token: secretToken,
      }),
    }
  );

  const json = await res.json();
  console.log(`Bot ${bot.accountId.slice(0, 8)}...: ${JSON.stringify(json)}`);
}

await Promise.all(bots.map(setWebhook));
