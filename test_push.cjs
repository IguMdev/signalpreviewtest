require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
    return;
  }
  
  // Find user who has push_subscription in user_metadata
  const user = users.users.find(u => u.user_metadata && u.user_metadata.push_subscription);
  
  if (!user) {
    console.log("Nenhum usuario com push_subscription encontrado.");
    return;
  }
  
  console.log("Found user:", user.email, user.id);
  
  const webpush = require("web-push");
  webpush.setVapidDetails(
    "mailto:contato@telesignal.com.br",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  
  try {
    await webpush.sendNotification(
      user.user_metadata.push_subscription,
      JSON.stringify({ title: "Venda aprovada! | igu.ads", body: "Sua comissão de R$ 97,00 foi aprovada!", icon: "/favicon.png" })
    );
    console.log("Notificação enviada com sucesso!");
  } catch(e) {
    console.error("Erro ao enviar:", e);
  }
}

run();
