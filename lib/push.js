import { arrayRemove, arrayUnion, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

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
  // Aynı cihazın eski kayıtlarını (aynı endpoint) temizle, sonra güncelini ekle.
  const ref = doc(db, "users", uid);
  const mine = JSON.stringify(sub);
  const old = ((await getDoc(ref)).data()?.pushSubs || []).filter((s) => {
    try { return s !== mine && JSON.parse(s).endpoint === sub.endpoint; } catch { return true; }
  });
  if (old.length) await setDoc(ref, { pushSubs: arrayRemove(...old) }, { merge: true });
  await setDoc(ref, { pushSubs: arrayUnion(mine) }, { merge: true });
  return "granted";
}

// Arkadaşın kayıtlı cihazlarına bildirim yollar (hata olursa sessizce geçer).
export async function notifyUser(friendUid, title, body) {
  try {
    const snap = await getDoc(doc(db, "users", friendUid));
    const subs = snap.data()?.pushSubs || [];
    if (!subs.length) return;
    const idToken = await auth.currentUser.getIdToken();
    await Promise.all(
      subs.map((s) =>
        fetch("/api/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken, subscription: JSON.parse(s), title, body }),
        }).catch(() => {})
      )
    );
  } catch {}
}
