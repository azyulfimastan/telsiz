"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { LANGS, THEMES, useI18n } from "@/lib/i18n";

const P = {
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  send: <path d="M5 12h14M13 6l6 6-6 6" />,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  bellOff: <><path d="M6 9a6 6 0 0 1 9.5-4.8M18 9c0 3 .8 4.6 1.4 5.4M4 15s2-1 2-6M10 19a2 2 0 0 0 4 0M3 3l18 18" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <><path d="M9 4H5v16h4" /><path d="M16 8l4 4-4 4M20 12H9" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  check: <path d="M5 12l4 4 10-10" />,
  alert: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.5" /></>,
  userPlus: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 8v6M16 11h6" /></>,
};

export function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}

export function Logo({ size = 40 }) {
  const bars = [[16, 24], [24, 14], [32, 6], [40, 14], [48, 24]];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--grad-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--grad-b)" }} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#lg)" />
      {bars.map(([x, y], i) => (
        <rect key={i} x={x - 3} y={y} width="6" height={64 - 2 * y} rx="3" fill="#fff" opacity={i === 2 ? 1 : 0.75} />
      ))}
    </svg>
  );
}

export function Avatar({ name = "?", photo, size = 40 }) {
  const initials = useMemo(
    () => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toLocaleUpperCase("tr")).join("") || "?",
    [name]
  );
  const hue = useMemo(() => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7), [name]);
  const style = { width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 40) % 360} 70% 48%))` };
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="avatar" style={style} src={photo} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar" style={style} aria-hidden="true">{initials}</span>
  );
}

const fmt = (s) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

// Ses mesajı oynatıcı: oynat/duraklat, dalga biçimi, süre
export function VoiceMsg({ src, id = "x" }) {
  const { t: tr } = useI18n();
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const bars = useMemo(() => {
    let h = [...String(id)].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
    return Array.from({ length: 32 }, () => {
      h = (h * 1664525 + 1013904223) >>> 0;
      return 5 + Math.round((h / 4294967296) * 17);
    });
  }, [id]);

  function onMeta(e) {
    const a = e.currentTarget;
    if (a.duration === Infinity) {
      a.currentTime = 1e101;
      a.ontimeupdate = () => {
        a.ontimeupdate = null;
        setDur(a.duration);
        a.currentTime = 0;
      };
    } else setDur(a.duration);
  }
  function toggle() {
    const a = ref.current;
    if (!a) return;
    a.paused ? a.play() : a.pause();
  }
  const pct = dur ? Math.min(1, t / dur) : 0;
  return (
    <div className="voice">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={onMeta}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setT(0); }}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
      />
      <button type="button" className="voice-btn" onClick={toggle} aria-label={playing ? tr("pause") : tr("play")}>
        <Icon name={playing ? "pause" : "play"} size={16} />
      </button>
      <div className="wave" aria-hidden="true">
        {bars.map((h, i) => (
          <i key={i} style={{ height: h }} className={i / bars.length < pct ? "on" : ""} />
        ))}
      </div>
      <span className="voice-time">{fmt(playing || t ? t : dur)}</span>
    </div>
  );
}

export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang" role="group" aria-label={t("language")}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={"lang-btn" + (lang === l.code ? " on" : "")}
          onClick={() => setLang(l.code)}
          title={l.name}
          aria-pressed={lang === l.code}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function ThemeSwitch() {
  const { t } = useI18n();
  const [cur, setCur] = useState("light");
  useEffect(() => { setCur(document.documentElement.dataset.theme || "light"); }, []);
  const pick = (id) => {
    setCur(id);
    document.documentElement.dataset.theme = id;
    try { localStorage.setItem("theme", id); } catch {}
    const c = getComputedStyle(document.documentElement).getPropertyValue("--grad-a").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c);
  };
  return (
    <div className="theme-sw" role="group" aria-label={t("theme")}>
      {THEMES.map((th) => (
        <button
          key={th.id}
          type="button"
          className={"theme-dot" + (cur === th.id ? " on" : "")}
          style={{ background: `linear-gradient(135deg, ${th.a}, ${th.b})` }}
          onClick={() => pick(th.id)}
          title={t(th.key)}
          aria-label={t(th.key)}
          aria-pressed={cur === th.id}
        />
      ))}
    </div>
  );
}
