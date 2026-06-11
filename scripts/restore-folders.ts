import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function main() {
  const { data: folders } = await supabase.from("schedule_folders").select("*");
  const { data: schedules } = await supabase.from("recurring_schedules").select("id, title, folder_id");

  const originalFolders = folders.filter(f => !['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].includes(f.name));
  const newFolders = folders.filter(f => ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].includes(f.name));

  let updatedCount = 0;
  for (const s of schedules) {
    const title = s.title.toLowerCase();
    let bestFolder = null;

    // Heuristics based on typical names:
    if (title.includes("dobra") && !title.includes("copy")) {
      bestFolder = originalFolders.find(f => f.name === "Dobras de Banca");
    } else if (title.includes("copy")) {
      bestFolder = originalFolders.find(f => f.name === "Copys");
    } else if (title.includes("anúncio") || title.includes("anuncio")) {
      bestFolder = originalFolders.find(f => f.name === "Anúncios");
    } else if (title.includes("pre live") || title.includes("pré live")) {
      bestFolder = originalFolders.find(f => f.name === "Video Redondo Pré live");
    } else if (title.includes("sessão") || title.includes("sessao")) {
      bestFolder = originalFolders.find(f => f.name === "Redondo Sessões");
    } else if (title.includes("video redondo") || title.includes("vídeo redondo")) {
      bestFolder = originalFolders.find(f => f.name === "Video Redondo Live Finalizada");
    } else if (title.includes("live") && title.includes("finalizada")) {
      bestFolder = originalFolders.find(f => f.name === "Video Redondo Live Finalizada");
    }

    if (bestFolder) {
      await supabase.from("recurring_schedules").update({ folder_id: bestFolder.id }).eq("id", s.id);
      updatedCount++;
    } else {
      // If no best folder, just set to null (Sem pasta)
      await supabase.from("recurring_schedules").update({ folder_id: null }).eq("id", s.id);
    }
  }
  console.log(`Restored ${updatedCount} schedules to original folders.`);

  for (const f of newFolders) {
    await supabase.from("schedule_folders").delete().eq("id", f.id);
    console.log(`Deleted weekday folder: ${f.name}`);
  }
}
main();
