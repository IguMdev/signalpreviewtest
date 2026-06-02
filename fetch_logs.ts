import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Parse .env manually
const envPath = ".env";
const envStr = fs.readFileSync(envPath, "utf8");
const env: Record<string, string> = {};
for (const line of envStr.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  v = v.replace(/^['"]|['"]$/g, "");
  env[k] = v;
}

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from("bot_logs")
    .select("event, message, error, bot_type, tg_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  
  if (error) {
    console.error("DB Error:", error);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
