import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTour, type TourStep } from "@/components/tour/TourProvider";
import {
  PlayCircle,
  RotateCcw,
  LayoutDashboard,
  Send,
  Sparkles,
  Users,
  UserPlus,
  CalendarClock,
  Video,
  Wallet,
  UserCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/tutorial")({
  component: TutorialPage,
});

const steps: TourStep[] = [
  {
    id: "welcome",
    title: "Bem-vindo ao tour guiado",
    description: (
      <>
        Vamos passar por cada ferramenta da plataforma. Use os botões <b>Próximo</b> e
        <b> Anterior</b> (ou as setas do teclado) para navegar. Pressione <b>Esc</b> para sair a
        qualquer momento.
      </>
    ),
    placement: "center",
    route: "/tutorial",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description:
      "Visão geral da operação: créditos disponíveis, contas Telegram conectadas, bots ativos, salas, planos ativos e a evolução de membros por grupo / canal.",
    selector: '[data-tour="nav-dashboard"]',
    route: "/dashboard",
    placement: "right",
  },
  {
    id: "telegram-accounts",
    title: "Contas Telegram",
    description:
      "Conecte e gerencie seus bots do Telegram aqui. Cada conta usa um token do BotFather e é o que de fato envia mensagens, vídeos e mídias para os grupos e canais.",
    selector: '[data-tour="nav-telegram-accounts"]',
    route: "/telegram-accounts",
    placement: "right",
  },
  {
    id: "add-account",
    title: "Como cadastrar uma conta",
    description: (
      <>
        Clique em <b>Adicionar Conta</b> para abrir o formulário. Você vai precisar do{" "}
        <b>token do bot</b> (gerado no @BotFather do Telegram) e de um rótulo para
        identificá-lo. Para contas premium, escolha o tipo "Premium" e siga os passos de
        autenticação.
      </>
    ),
    selector: '[data-tour="add-account"]',
    route: "/telegram-accounts",
    placement: "left",
  },
  {
    id: "premium-emojis",
    title: "Emojis Premium",
    description:
      "Cadastre e organize seus emojis premium personalizados para deixar as mensagens dos canais com identidade visual única.",
    selector: '[data-tour="nav-premium-emojis"]',
    route: "/premium-emojis",
    placement: "right",
  },
  {
    id: "rooms",
    title: "Salas",
    description:
      "Uma sala agrupa um conjunto de chats (grupos / canais) e a corretora vinculada. É a partir das salas que você dispara conteúdos, mensagens agendadas e vídeos.",
    selector: '[data-tour="nav-rooms"]',
    route: "/rooms",
    placement: "right",
  },
  {
    id: "add-room",
    title: "Como criar uma sala",
    description: (
      <>
        Clique em <b>Adicionar sala</b> e preencha: <b>ID do grupo / canal</b> do Telegram,
        nome, corretora vinculada e a conta Telegram padrão que vai operar essa sala. Depois de
        criada você pode adicionar mais chats à mesma sala.
      </>
    ),
    selector: '[data-tour="add-room"]',
    route: "/rooms",
    placement: "left",
  },
  {
    id: "membros",
    title: "Membros",
    description:
      "Acompanhe entradas, saídas e o saldo de membros em cada grupo ou canal. Use os filtros para isolar uma sala específica e ver o histórico de eventos.",
    selector: '[data-tour="nav-membros"]',
    route: "/membros",
    placement: "right",
  },
  {
    id: "mensagens",
    title: "Agendamentos",
    description:
      "Programe mensagens recorrentes ou pontuais para seus canais. Defina conteúdo, horário e qual sala / bot vai enviar — o sistema dispara automaticamente.",
    selector: '[data-tour="nav-mensagens"]',
    route: "/mensagens",
    placement: "right",
  },
  {
    id: "add-schedule",
    title: "Como criar um agendamento",
    description: (
      <>
        Em cada sala, clique em <b>Adicionar</b>. No formulário você define: <b>título</b>,
        <b> conteúdo</b> da mensagem (texto, mídia ou vídeo já cadastrado), <b>conta</b> que vai
        enviar e os <b>horários</b> de disparo. Pode adicionar vários horários para o mesmo
        agendamento.
      </>
    ),
    selector: '[data-tour="add-schedule"]',
    route: "/mensagens",
    placement: "left",
  },
  {
    id: "videos",
    title: "Vídeos",
    description: (
      <>
        Faça upload de vídeos para enviar ao Telegram em dois formatos:{" "}
        <b>redondo</b> (video note quadrado, até 60s) ou <b>normal</b> (vídeo comum, até 50 MB).
        Selecione o tipo antes de subir o arquivo.
      </>
    ),
    selector: '[data-tour="nav-videos"]',
    route: "/videos",
    placement: "right",
  },
  {
    id: "video-upload",
    title: "Como enviar um vídeo",
    description: (
      <>
        Escolha o <b>Tipo</b> (redondo ou normal), selecione o arquivo MP4, dê um <b>título</b> e
        clique em <b>Enviar</b>. Depois de salvo, use o botão <b>Enviar agora</b> no card do
        vídeo para disparar para uma sala específica.
      </>
    ),
    selector: '[data-tour="video-upload"]',
    route: "/videos",
    placement: "top",
  },
  {
    id: "recarga",
    title: "Recarga",
    description:
      "Adicione créditos à sua conta e gerencie seus planos ativos. Os créditos são consumidos por envios e funcionalidades premium.",
    selector: '[data-tour="nav-recarga"]',
    route: "/recarga",
    placement: "right",
  },
  {
    id: "recharge-plans",
    title: "Como fazer a recarga",
    description: (
      <>
        Escolha um <b>plano de sala</b> ou um pacote de bot (Inscritos, Interações, Boas-vindas
        ou Encaminhador) e clique no botão de <b>Comprar</b>. Você é redirecionado ao checkout
        seguro e os créditos / planos são liberados automaticamente após o pagamento.
      </>
    ),
    selector: '[data-tour="recharge-plans"]',
    route: "/recarga",
    placement: "top",
  },
  {
    id: "perfil",
    title: "Minha conta",
    description:
      "Atualize seus dados pessoais, foto de perfil e preferências. Aqui também ficam as opções de segurança da conta.",
    selector: '[data-tour="nav-perfil"]',
    route: "/perfil",
    placement: "right",
  },
  {
    id: "tutorial-footer",
    title: "Sempre disponível",
    description: (
      <>
        O <b>Tutorial</b> fica fixo no rodapé do menu lateral. Volte aqui sempre que quiser
        revisar uma ferramenta ou clicar em <b>Reiniciar tutorial</b> para começar do zero.
      </>
    ),
    selector: '[data-tour="nav-tutorial"]',
    route: "/tutorial",
    placement: "right",
  },
  {
    id: "done",
    title: "Tudo pronto!",
    description:
      "Você concluiu o tour. Pode rodar de novo a qualquer momento clicando em 'Iniciar tour' nesta página. Bons sinais!",
    placement: "center",
    route: "/tutorial",
  },
];

const features = [
  { icon: LayoutDashboard, label: "Dashboard", text: "Visão geral da sua operação." },
  { icon: Send, label: "Contas Telegram", text: "Conecte os bots que enviam mensagens." },
  { icon: Sparkles, label: "Emojis Premium", text: "Personalize a identidade visual." },
  { icon: Users, label: "Salas", text: "Agrupe chats e corretora." },
  { icon: UserPlus, label: "Membros", text: "Entradas, saídas e saldo." },
  { icon: CalendarClock, label: "Agendamentos", text: "Mensagens programadas." },
  { icon: Video, label: "Vídeos", text: "Redondos ou normais para o Telegram." },
  { icon: Wallet, label: "Recarga", text: "Créditos e planos ativos." },
  { icon: UserCircle, label: "Minha conta", text: "Perfil e segurança." },
];

function TutorialPage() {
  const { start } = useTour();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tutorial</h1>
        <p className="text-sm text-muted-foreground">
          Faça um tour guiado pela plataforma. Vamos destacar cada ferramenta no menu e explicar
          o que ela faz.
        </p>
      </div>

      <Card className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Tour interativo</h2>
          <p className="text-sm text-muted-foreground">
            {steps.length} passos · cerca de 3 minutos. Vamos te mostrar como cadastrar conta,
            criar agendamento, enviar vídeo e fazer a recarga.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => start(steps)} size="lg">
            <PlayCircle className="size-5" />
            Iniciar tour
          </Button>
          <Button onClick={() => start(steps)} size="lg" variant="outline">
            <RotateCcw className="size-4" />
            Reiniciar tutorial
          </Button>
        </div>
      </Card>

      <div>
        <h2 className="font-semibold mb-3">O que você vai aprender</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, label, text }) => (
            <Card key={label} className="p-4 flex gap-3 items-start">
              <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{text}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}