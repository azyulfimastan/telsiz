"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

const CURRENT = process.env.NEXT_PUBLIC_BUILD;

// Yeni sürüm yayınlanınca uygulamayı otomatik yeniler (ana ekran uygulamasında elle silmeye gerek kalmaz)
export default function Updater() {
  const { t } = useI18n();
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!CURRENT || CURRENT === "dev") return;
    let alive = true;
    const check = async (resume) => {
      try {
        const r = await fetch("/api/version?t=" + Date.now(), { cache: "no-store" });
        const { v } = await r.json();
        if (!alive || !v || v === CURRENT) return;
        const typing = document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && document.activeElement.value;
        if (!document.body.classList.contains("talking") && !typing) location.reload();
        else setStale(true);
      } catch {}
    };
    const onVis = () => { if (document.visibilityState === "visible") check(true); };
    const onBack = () => check(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onBack);
    window.addEventListener("pageshow", onBack);
    window.addEventListener("online", onBack);
    check(true);
    const id = setInterval(() => { if (document.visibilityState === "visible") check(false); }, 15000);
    return () => {
      alive = false; clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onBack); window.removeEventListener("pageshow", onBack); window.removeEventListener("online", onBack);
    };
  }, []);

  if (!stale) return null;
  return (
    <button type="button" className="update-bar" onClick={() => location.reload()}>
      {t("updAvail")}
    </button>
  );
}
