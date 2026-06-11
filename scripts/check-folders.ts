import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function main() {
  const { data: folders } = await supabase.from("schedule_folders").select("*");
  console.log("Existing folders:", folders);

  const { data: schedules } = await supabase.from("recurring_schedules").select("id, title, folder_id");
  console.log("Schedules:", schedules.length);
}
main();
