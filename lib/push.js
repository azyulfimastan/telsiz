import { collection, deleteDoc, deleteField, doc, getDocs, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function hash(str) {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = (h1 * 33) ^ c; h2 = (h2 * 33) ^ c;
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Bildirim iznini ister (gerekirse), aboneliği oluşturur ve Firestore'a kaydeder.
export async function enablePush(uid, { ask = true } = {}) {
  if (!pushSupported() || !PUBLIC_KEY) return "unsupported";
  let perm = Notification.permission;
  if (perm === "default" && ask) perm = await Notification.requestPermission();
  if (perm !== "granted") return perm;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
    });
  }
  // Abonelik, yalnızca sahibinin ve arkadaşlarının okuyabildiği alt koleksiyonda tutulur.
  const id = hash(sub.endpoint);
  await setDoc(doc(db, "users", uid, "push", id), { sub: JSON.stringify(sub), at: Date.now() });
  // Eski (herkese açık) dizi alanını temizle
  await setDoc(doc(db, "users", uid), { pushSubs: deleteField() }, { merge: true }).catch(() => {});
  return "granted";
}

// Arkadaşın kayıtlı cihazlarına bildirim yollar; süresi dolmuş abonelikleri siler.
export async function notifyUser(friendUid, title, body) {
  try {
    const snap = await getDocs(collection(db, "users", friendUid, "push"));
    if (snap.empty) return;
    const idToken = await auth.currentUser.getIdToken();
    await Promise.all(
      snap.docs.map(async (d) => {
        try {
          const res = await fetch("/api/push", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ idToken, subscription: JSON.parse(d.data().sub), title, body }),
          });
          const j = await res.json().catch(() => ({}));
          if (j.gone) deleteDoc(d.ref).catch(() => {});
        } catch {}
      })
    );
  } catch {}
}

// Bu cihazın bildirim aboneliğini kapatır (tarayıcı izni kalır, yalnızca Telsiz bildirimi gönderilmez).
export async function disablePush(uid) {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await deleteDoc(doc(db, "users", uid, "push", hash(sub.endpoint))).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {}
}
