import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-sans/latin-ext-700.css";
import "@fontsource/ibm-plex-sans/latin-ext-400.css";
import "@fontsource/ibm-plex-sans/latin-ext-500.css";
import "@fontsource/ibm-plex-sans/latin-ext-600.css";


import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import Updater from "./Updater";
import VersionTag from "./VersionTag";

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
      <head><script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"pink";document.documentElement.dataset.mode=localStorage.getItem("mode")||"light"}catch(e){}` }} /></head>
      <body><LangProvider>{children}<Updater /><VersionTag /></LangProvider></body>
    </html>
  );
}
