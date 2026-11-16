import webpush from "web-push";

export const runtime = "nodejs";

const ALLOWED_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
];

function allowedEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

export async function POST(req) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return Response.json({ error: "push not configured" }, { status: 500 });

  let data;
  try {
    data = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const { idToken, subscription, title, body } = data || {};
  if (!idToken || !subscription?.endpoint || !allowedEndpoint(subscription.endpoint)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  // Çağıran gerçekten giriş yapmış bir Firebase kullanıcısı mı?
  const check = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!check.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  webpush.setVapidDetails("https://telsiz-five.vercel.app", pub, priv);
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: String(title || "Telsiz").slice(0, 80), body: String(body || "").slice(0, 200) }),
      { TTL: 60 * 60 }
    );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, gone: e.statusCode === 404 || e.statusCode === 410 }, { status: 200 });
  }
}
