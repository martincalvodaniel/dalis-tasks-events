import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dalis Tasks & Events",
    short_name: "Dalis",
    description: "Tus tareas y fechas importantes, también sin conexión",
    start_url: "/workspace",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#047857",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
