self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = { title: "Telsiz", body: "Yeni mesaj" };
  try { d = event.data.json(); } catch {}
  event.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "telsiz-msg",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow("/");
    })
  );
});
