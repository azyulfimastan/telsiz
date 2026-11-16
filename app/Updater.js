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
        if (resume && !document.body.classList.contains("talking")) location.reload();
        else setStale(true);
      } catch {}
    };
    const onVis = () => { if (document.visibilityState === "visible") check(true); };
    document.addEventListener("visibilitychange", onVis);
    check(true);
    const id = setInterval(() => check(false), 120000);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); clearInterval(id); };
  }, []);

  if (!stale) return null;
  return (
    <button type="button" className="update-bar" onClick={() => location.reload()}>
      {t("updAvail")}
    </button>
  );
}
