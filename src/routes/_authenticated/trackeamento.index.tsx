import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/trackeamento/")({
  beforeLoad: () => {
    throw redirect({ to: "/trackeamento/pixels" });
  },
});