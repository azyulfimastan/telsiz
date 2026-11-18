self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = { title: "Telsiz", body: "Yeni mesaj" };
  try { d = event.data.json(); } catch {}
  event.waitUntil(
    (async () => {
      // Uygulama ekrandayken bildirim gösterme. iPhone her push için bildirim gösterilmesini şart koştuğundan,
      // sessiz gösterip hemen kapatıyoruz.
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = wins.some((c) => c.visibilityState === "visible");
      await self.registration.showNotification(d.title, {
        body: d.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "telsiz-msg",
        renotify: !visible,
        silent: visible,
      });
      if (visible) {
        const list = await self.registration.getNotifications({ tag: "telsiz-msg" });
        list.forEach((n) => n.close());
      }
    })()
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
