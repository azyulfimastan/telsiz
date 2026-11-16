import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-ext-400.css";
import "@fontsource/ibm-plex-sans/latin-ext-500.css";
import "@fontsource/ibm-plex-sans/latin-ext-600.css";
import "@fontsource/great-vibes/latin-400.css";
import "@fontsource/great-vibes/latin-ext-400.css";
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel/latin-ext-600.css";
import "@fontsource/cinzel-decorative/latin-700.css";
import "@fontsource/cinzel-decorative/latin-ext-700.css";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";

export const metadata = {
  title: "Telsiz",
  description: "Arkadaşlarınla mesajlaş, bas-konuş telsiz gibi sesli mesaj gönder.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Telsiz", statusBarStyle: "black-translucent" },
};

export const viewport = { themeColor: "#5b6cff", viewportFit: "cover", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"light"}catch(e){}` }} /></head>
      <body><LangProvider>{children}</LangProvider></body>
    </html>
  );
}
