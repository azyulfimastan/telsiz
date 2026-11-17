"use client";
import { createContext, createElement, useContext, useEffect, useState } from "react";

export const LANGS = [
  { code: "tr", label: "TR", name: "Türkçe", locale: "tr-TR" },
  { code: "pl", label: "PL", name: "Polski", locale: "pl-PL" },
  { code: "en", label: "EN", name: "English", locale: "en-GB" },
];

export const THEMES = [
  { id: "light", key: "thLight", a: "#5b6cff", b: "#a45bff" },
  { id: "pink", key: "thPink", a: "#ec4899", b: "#f97316" },
  { id: "mint", key: "thMint", a: "#10b981", b: "#06b6d4" },
  { id: "ocean", key: "thOcean", a: "#0ea5e9", b: "#6366f1" },
  { id: "purple", key: "thPurple", a: "#8b5cf6", b: "#ec4899" },
  { id: "night", key: "thNight", a: "#f59e0b", b: "#e11d48" },
];

const D = {
  tr: {
    loading: "Yükleniyor…",
    tagline: "Arkadaşlarınla yaz, basılı tutup konuş.",
    googleLogin: "Google ile giriş yap",
    firestoreErr: "Firestore: {code}. Firestore kuralları yayınlanmış mı?",
    someone: "Biri", friend: "Arkadaş",
    ownAddress: "Bu senin adresin.",
    noUser: "Bu adresle kayıtlı kullanıcı yok. Önce uygulamaya Google ile girmesi gerekir.",
    alreadyFriends: "Zaten arkadaşsınız.",
    alreadyRequested: "Bu kişi sana zaten istek göndermiş. Soldan kabul edebilirsin.",
    requestSent: "İstek gönderildi.",
    requestFail: "İstek gönderilemedi: {e}",
    acceptFail: "Kabul edilemedi: {e}",
    you: "Sen: ", voiceMsg: "Sesli mesaj", message: "Mesaj", newMessage: "Yeni mesaj",
    notifOn: "Bildirimleri aç", notifBlocked: "Bildirimler tarayıcıda engelli", logout: "Çıkış yap",
    iosHint: "iPhone'da bildirim için siteyi Paylaş menüsünden \"Ana Ekrana Ekle\" ile kur.",
    requests: "İstekler", wantsFriend: "Arkadaş olmak istiyor", accept: "Kabul et",
    chats: "Sohbetler", noFriends: "Henüz arkadaşın yok. Aşağıdan Gmail adresiyle ekle.",
    unread: "Okunmamış mesaj", pending: "Bekleyen istekler", waitingAccept: "Kabul etmesi bekleniyor",
    addFriend: "Arkadaş ekle", gmail: "Gmail adresi", add: "Ekle",
    pickChat: "Bir sohbet seç. Mikrofon düğmesine basılı tutarak telsiz gibi konuşabilirsin.",
    backToList: "Sohbet listesine dön",
    stInRoom: "Odada", stOnline: "Çevrimiçi", stOffline: "Çevrimdışı", stLastSeen: "Son görülme: {t}", stToday: "bugün", stYesterday: "dün",
    emptyChat: "Henüz mesaj yok. Yaz ya da mikrofon düğmesine basılı tutup konuş.",
    sendFail: "Mesaj gönderilemedi: {e}", voiceFail: "Sesli mesaj gönderilemedi: {e}",
    tooLong: "Kayıt çok uzun. En fazla 60 saniye kaydedebilirsin.",
    micNeeded: "Mikrofon izni gerekli. Tarayıcı adres çubuğundan mikrofona izin ver.",
    writeMsg: "Mesaj yaz", sendBtn: "Gönder", holdToTalk: "Basılı tut, konuş · sağa kaydır: kilitle",
    connecting: "Bağlanıyor…", live: "Canlı yayında", releaseSend: "Bırakınca biter",
    hint: "Basılı tut ve konuş, bırakınca biter. Kilit düğmesiyle elin serbest konuşabilirsin.",
    speaking: "{name} konuşuyor…", tapSound: "Sesi açmak için dokun", diagLive: "Canlı iletildi.", diagOffline: "Arkadaşın çevrimdışı, ses iletilmedi.", diagNoStart: "Canlı bağlantı kurulamadı, ses iletilmedi.", diagNoAnswer: "Arkadaşın uygulamayı açmamış olabilir, ses iletilmedi.", diagNoConnect: "Canlı bağlantı kurulamadı, ses iletilmedi.", diagNotHeard: "Arkadaşın sesi çalamadı, ses iletilmedi.", dgTitle: "Test et", dgIntro: "Mikrofon, ses, bildirim ve canlı bağlantıyı kontrol eder.", dgRun: "Testi başlat", dgClose: "Kapat", dgApp: "Kurulum", dgInstalled: "Ana ekran uygulaması olarak açık", dgBrowser: "Tarayıcıdan açık (iPhone'da bildirim için ana ekrana ekle)", dgMic: "Mikrofon", dgMicOk: "İzin var, mikrofon çalışıyor", dgMicFail: "Mikrofon izni yok veya mikrofon bulunamadı", dgSound: "Ses çalma", dgBeep: "Bip sesi çalındı. Duydun mu?", dgSoundFail: "Tarayıcı sesi engelledi. Ekrana dokunup tekrar dene", dgNotif: "Bildirim", dgNotifNo: "Bu tarayıcı bildirimi desteklemiyor", dgNotifOff: "İzin verilmedi", dgNotifOk: "Açık, bu cihaz kayıtlı", dgNotifNoSub: "İzin var ama cihaz kayıtlı değil. Sayfayı yenile", dgFs: "Sunucu", dgFsOk: "Bağlantı var", dgFsFail: "Sunucuya ulaşılamadı", dgNet: "Canlı bağlantı ağı", dgNetOk: "Ağ uygun (aktarma sunucusu dahil)", dgNetStun: "Ağ uygun", dgNetBad: "Ağ canlı bağlantıyı engelliyor olabilir (Wi-Fi veya mobil veri değiştir)", diagTest: "Test et", credit: "Ahmet Kula tarafından geliştirilmiştir", creditPre: "", creditName: "Ahmet Kula", creditPost: "tarafından geliştirilmiştir", theme: "Tema", thLight: "Mavi", thPink: "Pembe", thMint: "Nane", thOcean: "Okyanus", thPurple: "Mor", thNight: "Turuncu", lockOnAir: "{name} ile yayındasın, durdurmak için dokun", delMsg: "Mesajı sil", cancel: "Vazgeç", delFail: "Silinemedi: {e}", lockTalk: "Kilitle: basmadan konuş", stopLock: "Yayını bitir", lockedHint: "Kilitli, elin serbest. Bitirmek için kare düğmeye dokun.", play: "Oynat", pause: "Duraklat", language: "Dil", offlineRec: "Arkadaşın uygulaması kapalı görünüyor, ses ulaşmayabilir", slideLock: "Kilitlemek için sağa kaydır", older: "Daha eski mesajlar", settings: "Ayarlar", continue: "Devam et", updAvail: "Yeni sürüm var. Yenilemek için dokun", intro: "Açılış", introClassic: "Klasik", introScroll: "Parşömen", introMinimal: "Sade",
  },
  pl: {
    loading: "Ładowanie…",
    tagline: "Pisz do znajomych i mów, przytrzymując przycisk.",
    googleLogin: "Zaloguj się przez Google",
    firestoreErr: "Firestore: {code}. Czy reguły Firestore zostały opublikowane?",
    someone: "Ktoś", friend: "Znajomy",
    ownAddress: "To twój adres.",
    noUser: "Brak użytkownika z tym adresem. Najpierw musi zalogować się w aplikacji przez Google.",
    alreadyFriends: "Już jesteście znajomymi.",
    alreadyRequested: "Ta osoba już wysłała ci zaproszenie. Możesz je zaakceptować po lewej.",
    requestSent: "Zaproszenie wysłane.",
    requestFail: "Nie udało się wysłać zaproszenia: {e}",
    acceptFail: "Nie udało się zaakceptować: {e}",
    you: "Ty: ", voiceMsg: "Wiadomość głosowa", message: "Wiadomość", newMessage: "Nowa wiadomość",
    notifOn: "Włącz powiadomienia", notifBlocked: "Powiadomienia zablokowane w przeglądarce", logout: "Wyloguj",
    iosHint: "Na iPhonie, aby dostawać powiadomienia, dodaj stronę do ekranu głównego z menu Udostępnij.",
    requests: "Zaproszenia", wantsFriend: "Chce zostać twoim znajomym", accept: "Akceptuj",
    chats: "Rozmowy", noFriends: "Nie masz jeszcze znajomych. Dodaj ich poniżej adresem Gmail.",
    unread: "Nieprzeczytana wiadomość", pending: "Oczekujące zaproszenia", waitingAccept: "Czeka na akceptację",
    addFriend: "Dodaj znajomego", gmail: "Adres Gmail", add: "Dodaj",
    pickChat: "Wybierz rozmowę. Przytrzymaj przycisk mikrofonu, aby mówić jak przez krótkofalówkę.",
    backToList: "Wróć do listy rozmów",
    stInRoom: "W pokoju", stOnline: "Online", stOffline: "Offline", stLastSeen: "Ostatnio: {t}", stToday: "dzisiaj", stYesterday: "wczoraj", stLastSeen: "Ostatnio: {t}", stToday: "dzisiaj", stYesterday: "wczoraj",
    emptyChat: "Brak wiadomości. Napisz albo przytrzymaj mikrofon i mów.",
    sendFail: "Nie udało się wysłać wiadomości: {e}", voiceFail: "Nie udało się wysłać wiadomości głosowej: {e}",
    tooLong: "Nagranie jest za długie. Maksymalnie 60 sekund.",
    micNeeded: "Potrzebny dostęp do mikrofonu. Zezwól na niego w pasku adresu przeglądarki.",
    writeMsg: "Napisz wiadomość", sendBtn: "Wyślij", holdToTalk: "Przytrzymaj i mów · w prawo: blokada",
    connecting: "Łączenie…", live: "Na żywo", releaseSend: "Puść, aby zakończyć",
    hint: "Przytrzymaj i mów, puść, aby zakończyć. Kłódką mówisz bez przytrzymywania.",
    speaking: "{name} mówi…", tapSound: "Dotknij, aby włączyć dźwięk", diagLive: "Przesłano na żywo.", diagOffline: "Znajomy jest offline, głos nie został przekazany.", diagNoStart: "Nie udało się połączyć, głos nie został przekazany.", diagNoAnswer: "Znajomy może nie mieć otwartej aplikacji, głos nie został przekazany.", diagNoConnect: "Nie udało się połączyć, głos nie został przekazany.", diagNotHeard: "Znajomy nie mógł odtworzyć głosu, głos nie został przekazany.", dgTitle: "Test", dgIntro: "Sprawdza mikrofon, dźwięk, powiadomienia i połączenie na żywo.", dgRun: "Uruchom test", dgClose: "Zamknij", dgApp: "Instalacja", dgInstalled: "Otwarto jako aplikacja z ekranu głównego", dgBrowser: "Otwarto w przeglądarce (na iPhonie dodaj do ekranu głównego, aby mieć powiadomienia)", dgMic: "Mikrofon", dgMicOk: "Jest zgoda, mikrofon działa", dgMicFail: "Brak zgody lub nie znaleziono mikrofonu", dgSound: "Odtwarzanie", dgBeep: "Odtworzono sygnał. Słyszysz go?", dgSoundFail: "Przeglądarka zablokowała dźwięk. Dotknij ekranu i spróbuj ponownie", dgNotif: "Powiadomienia", dgNotifNo: "Ta przeglądarka nie obsługuje powiadomień", dgNotifOff: "Brak zgody", dgNotifOk: "Włączone, urządzenie zapisane", dgNotifNoSub: "Jest zgoda, ale urządzenie nie jest zapisane. Odśwież stronę", dgFs: "Serwer", dgFsOk: "Połączono", dgFsFail: "Brak połączenia z serwerem", dgNet: "Sieć dla połączeń na żywo", dgNetOk: "Sieć odpowiednia (z serwerem pośredniczącym)", dgNetStun: "Sieć odpowiednia", dgNetBad: "Sieć może blokować połączenia na żywo (zmień Wi-Fi lub dane mobilne)", diagTest: "Test", credit: "Stworzone przez Ahmet Kula", creditPre: "Stworzone przez", creditName: "Ahmet Kula", creditPost: "", theme: "Motyw", thLight: "Niebieski", thPink: "Różowy", thMint: "Miętowy", thOcean: "Ocean", thPurple: "Fioletowy", thNight: "Pomarańczowy", lockOnAir: "Nadajesz do: {name}. Dotknij, aby zatrzymać", delMsg: "Usuń wiadomość", cancel: "Anuluj", delFail: "Nie udało się usunąć: {e}", lockTalk: "Zablokuj: mów bez przytrzymywania", stopLock: "Zakończ nadawanie", lockedHint: "Zablokowane, możesz puścić. Aby zakończyć, dotknij kwadratu.", play: "Odtwórz", pause: "Pauza", language: "Język", offlineRec: "Aplikacja znajomego wygląda na zamkniętą, głos może nie dotrzeć", slideLock: "Przesuń w prawo, aby zablokować", older: "Starsze wiadomości", settings: "Ustawienia", continue: "Dalej", updAvail: "Dostępna nowa wersja. Dotknij, aby odświeżyć", intro: "Intro", introClassic: "Klasyczne", introScroll: "Pergamin", introMinimal: "Minimalne",
  },
  en: {
    loading: "Loading…",
    tagline: "Message your friends, hold to talk.",
    googleLogin: "Sign in with Google",
    firestoreErr: "Firestore: {code}. Have the Firestore rules been published?",
    someone: "Someone", friend: "Friend",
    ownAddress: "That's your own address.",
    noUser: "No user with this address. They need to sign in to the app with Google first.",
    alreadyFriends: "You're already friends.",
    alreadyRequested: "This person already sent you a request. You can accept it on the left.",
    requestSent: "Request sent.",
    requestFail: "Couldn't send the request: {e}",
    acceptFail: "Couldn't accept: {e}",
    you: "You: ", voiceMsg: "Voice message", message: "Message", newMessage: "New message",
    notifOn: "Turn on notifications", notifBlocked: "Notifications are blocked in the browser", logout: "Sign out",
    iosHint: "On iPhone, install the site from the Share menu with \"Add to Home Screen\" to get notifications.",
    requests: "Requests", wantsFriend: "Wants to be friends", accept: "Accept",
    chats: "Chats", noFriends: "No friends yet. Add one below with their Gmail address.",
    unread: "Unread message", pending: "Pending requests", waitingAccept: "Waiting for them to accept",
    addFriend: "Add friend", gmail: "Gmail address", add: "Add",
    pickChat: "Pick a chat. Hold the microphone button to talk like a walkie-talkie.",
    backToList: "Back to chat list",
    stInRoom: "In the room", stOnline: "Online", stOffline: "Offline", stLastSeen: "Last seen: {t}", stToday: "today", stYesterday: "yesterday",
    emptyChat: "No messages yet. Type, or hold the microphone and talk.",
    sendFail: "Couldn't send the message: {e}", voiceFail: "Couldn't send the voice message: {e}",
    tooLong: "Recording too long. 60 seconds at most.",
    micNeeded: "Microphone permission needed. Allow it from the browser's address bar.",
    writeMsg: "Type a message", sendBtn: "Send", holdToTalk: "Hold to talk · slide right: lock",
    connecting: "Connecting…", live: "Live", releaseSend: "Release to finish",
    hint: "Hold to talk, release to stop. Use the lock to talk hands-free.",
    speaking: "{name} is talking…", tapSound: "Tap to turn on sound", diagLive: "Delivered live.", diagOffline: "Your friend is offline, the voice wasn't delivered.", diagNoStart: "Couldn't connect live, the voice wasn't delivered.", diagNoAnswer: "Your friend may not have the app open, the voice wasn't delivered.", diagNoConnect: "Couldn't connect live, the voice wasn't delivered.", diagNotHeard: "Your friend couldn't play the voice, it wasn't delivered.", dgTitle: "Test", dgIntro: "Checks the microphone, sound, notifications and the live connection.", dgRun: "Run test", dgClose: "Close", dgApp: "Install", dgInstalled: "Opened as a home screen app", dgBrowser: "Opened in the browser (on iPhone, add to Home Screen for notifications)", dgMic: "Microphone", dgMicOk: "Allowed, microphone works", dgMicFail: "Permission denied or no microphone found", dgSound: "Sound playback", dgBeep: "A beep was played. Did you hear it?", dgSoundFail: "The browser blocked sound. Tap the screen and try again", dgNotif: "Notifications", dgNotifNo: "This browser doesn't support notifications", dgNotifOff: "Not allowed", dgNotifOk: "On, this device is registered", dgNotifNoSub: "Allowed, but this device isn't registered. Refresh the page", dgFs: "Server", dgFsOk: "Connected", dgFsFail: "Can't reach the server", dgNet: "Live connection network", dgNetOk: "Network is fine (relay available)", dgNetStun: "Network is fine", dgNetBad: "The network may block live connections (switch Wi-Fi or mobile data)", diagTest: "Test", credit: "Developed by Ahmet Kula", creditPre: "Developed by", creditName: "Ahmet Kula", creditPost: "", theme: "Theme", thLight: "Blue", thPink: "Pink", thMint: "Mint", thOcean: "Ocean", thPurple: "Purple", thNight: "Orange", lockOnAir: "On air with {name}. Tap to stop", delMsg: "Delete message", cancel: "Cancel", delFail: "Couldn't delete: {e}", lockTalk: "Lock: talk hands-free", stopLock: "End transmission", lockedHint: "Locked, hands free. Tap the square to finish.", play: "Play", pause: "Pause", language: "Language", offlineRec: "Your friend's app looks closed, the voice may not arrive", slideLock: "Slide right to lock", older: "Older messages", settings: "Settings", continue: "Continue", updAvail: "New version available. Tap to refresh", intro: "Intro", introClassic: "Classic", introScroll: "Scroll", introMinimal: "Minimal",
  },
};

const Ctx = createContext({ lang: "tr", setLang: () => {}, t: (k) => k, locale: "tr-TR" });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState("tr");
  // Giriş yapmış kullanıcının dili hatırlanır. Giriş yapmamışsa açılış ekranı kaydı silip Türkçe'ye döner
  useEffect(() => {
    let l = "";
    try { l = localStorage.getItem("lang") || ""; } catch {}
    if (D[l]) setLangState(l);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch {}
  };
  const t = (k, p) => {
    let s = D[lang][k] ?? D.tr[k] ?? k;
    if (p) for (const x in p) s = s.replace("{" + x + "}", p[x]);
    return s;
  };
  const locale = LANGS.find((x) => x.code === lang).locale;
  return createElement(Ctx.Provider, { value: { lang, setLang, t, locale } }, children);
}

export const useI18n = () => useContext(Ctx);
