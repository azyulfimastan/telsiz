import "./globals.css";

export const metadata = {
  title: "Telsiz",
  description: "Arkadaşlarınla mesajlaş, bas-konuş telsiz gibi sesli mesaj gönder.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Telsiz", statusBarStyle: "black-translucent" },
};

export const viewport = { themeColor: "#0f172a" };

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
