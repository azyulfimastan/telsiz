import "./globals.css";

export const metadata = {
  title: "Telsiz",
  description: "Arkadaşlarınla mesajlaş, bas-konuş telsiz gibi sesli mesaj gönder.",
  manifest: "/manifest.json",
};

export const viewport = { themeColor: "#0f172a" };

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
