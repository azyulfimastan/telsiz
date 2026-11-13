# Telsiz

Gmail ile giriş, arkadaşlarla mesajlaşma ve bas-konuş (telsiz) sesli mesaj. Next.js + Firebase, Vercel'de yayınlanır.

## Kurulum
1. Firebase projesi aç → Authentication'da **Google** girişini aç.
2. Firestore Database oluştur, `firestore.rules` içeriğini Rules sekmesine yapıştır.
3. Proje ayarlarından web uygulaması ekle, değerleri `.env.local` dosyasına yaz (`.env.example`'a bak).
4. `npm install && npm run dev`
5. Vercel'e import et, aynı env değişkenlerini ekle. Firebase → Authentication → Authorized domains'e Vercel adresini ekle.

## Sonraki adımlar
- Push bildirimi (FCM + service worker)
- iPhone için "Ana ekrana ekle" desteği
- Canlı (WebRTC) telsiz
