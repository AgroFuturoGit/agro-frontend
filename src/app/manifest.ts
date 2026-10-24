import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProduPlan",
    short_name: "ProduPlan",
    description:
      "ProduPlan: planejamento e acompanhamento da produção agrícola familiar.",
    start_url: "/admin",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2b7a3d",
    lang: "pt-BR",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
