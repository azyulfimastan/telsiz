"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { LANGS, THEMES, useI18n } from "@/lib/i18n";

function GoogleG() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

const P = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
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
  const [cur, setCur] = useState("pink");
  useEffect(() => { setCur(document.documentElement.dataset.theme || "pink"); }, []);
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

export function ModeSwitch() {
  const { lang } = useI18n();
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.mode === "dark"); }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.mode = next ? "dark" : "light";
    try { localStorage.setItem("mode", next ? "dark" : "light"); } catch {}
  };
  const label = dark ? { tr: "Açık görünüm", pl: "Jasny motyw", en: "Light mode" }[lang] : { tr: "Koyu görünüm", pl: "Ciemny motyw", en: "Dark mode" }[lang];
  return (
    <button type="button" className="mode-btn" onClick={toggle} title={label} aria-label={label} aria-pressed={dark}>
      <Icon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}

// "Ahmet Kula tarafından geliştirilmiştir": çevresi eski Roma yazısı, isim sade
export function Credit() {
  const { t } = useI18n();
  return (
    <span className="credit-line" aria-label={t("credit")}>
      {t("creditPre") && <span className="roman">{t("creditPre")}</span>}
      <span className="plain-name">{t("creditName")}</span>
      {t("creditPost") && <span className="roman">{t("creditPost")}</span>}
    </span>
  );
}

// Harfler tek tek yukarıdan süzülerek belirir (açılış yazısı)
function Typed({ text, start, step = 60, className = "" }) {
  const words = text.split(" ");
  let i = 0;
  return (
    <span className={className}>
      {words.map((w, wi) => (
        <span key={wi} className="tw">
          {[...w].map((ch) => {
            const d = start + step * i++;
            return <span key={i} className="tl" style={{ animationDelay: d + "ms" }}>{ch}</span>;
          })}
          {wi < words.length - 1 && (i++, "\u00a0")}
        </span>
      ))}
    </span>
  );
}

function TypedCredit({ start }) {
  const { t } = useI18n();
  const pre = t("creditPre"), name = t("creditName"), post = t("creditPost");
  const step = 40;
  let at = start;
  const part = (txt, cls) => {
    if (!txt) return null;
    const el = <Typed key={cls + txt} text={txt} start={at} step={step} className={cls} />;
    at += (txt.length + 1) * step;
    return el;
  };
  return (
    <span className="credit-line" aria-label={t("credit")}>
      {part(pre, "roman")}
      {part(name, "plain-name")}
      {part(post, "roman")}
    </span>
  );
}

// Uygulama açılışı: her açılışta önce dil seçilir, sonra büyük karşılama animasyonu oynar
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  l: (i * 37 + 11) % 100, t: (i * 53 + 7) % 100, s: 4 + (i * 7) % 9, d: (i * 0.37) % 3.2, k: 2.2 + (i % 5) * 0.6,
}));

function Backdrop() {
  return (
    <div className="sp-bg" aria-hidden="true">
      <i className="blob b1" /><i className="blob b2" /><i className="blob b3" />
      {SPARKS.map((p, i) => (
        <i key={i} className="spark" style={{ left: p.l + "%", top: p.t + "%", width: p.s, height: p.s, animationDelay: p.d + "s", animationDuration: p.k + "s" }} />
      ))}
    </div>
  );
}

function Orb({ size = 92 }) {
  return (
    <div className="orb-wrap">
      <i className="ring r1" /><i className="ring r2" /><i className="ring r3" /><i className="ring r4" />
      <div className="orb"><Logo size={size} /></div>
    </div>
  );
}

// Telsiz "çıt-pşşt" sesi: dokunuşla tetiklenir, iPhone'da da çalar
function radioClick() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const g = ctx.createGain(); g.gain.value = 0.18; g.connect(ctx.destination);
    const click = ctx.createOscillator(); click.type = "square"; click.frequency.value = 1800;
    const cg = ctx.createGain(); cg.gain.setValueAtTime(0.5, now); cg.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    click.connect(cg); cg.connect(g); click.start(now); click.stop(now + 0.05);
    const len = Math.floor(ctx.sampleRate * 0.22), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 0.7;
    n.connect(bp); bp.connect(g); n.start(now + 0.03);
    const beep = ctx.createOscillator(); beep.frequency.value = 1250;
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, now + 0.26); bg.gain.exponentialRampToValueAtTime(0.35, now + 0.28); bg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    beep.connect(bg); bg.connect(g); beep.start(now + 0.26); beep.stop(now + 0.42);
    setTimeout(() => ctx.close(), 700);
  } catch {}
}

export function Splash() {
  const { t, setLang } = useI18n();
  const [phase, setPhase] = useState("off");
  const [user, setUser] = useState(undefined);
  const [err, setErr] = useState("");
  const prevUser = useRef(undefined);

  useEffect(() => {
    setPhase("show");
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Giriş bu ekrandan yapılınca açılış ekranı kapanır
  useEffect(() => {
    if (prevUser.current === null && user && phase !== "off") setPhase("out");
    prevUser.current = user;
  }, [user, phase]);

  const login = async () => {
    setErr("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        return signInWithRedirect(auth, googleProvider);
      }
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      setErr(e.code + ": " + e.message);
    }
  };

  useEffect(() => {
    if (phase === "out") {
      const b = setTimeout(() => setPhase("off"), 700);
      return () => clearTimeout(b);
    }
  }, [phase]);

  const choose = (e, code) => {
    e.stopPropagation();
    radioClick();
    setLang(code);
    try { localStorage.setItem("langChosen", "1"); } catch {}
    setPhase("credit");
  };

  if (phase === "off") return null;
  return (
    <div className={"splash" + (phase === "out" ? " out" : "")} >
      <Backdrop />
      <div className="splash-in">
        {(
          <>
            <Orb size={84} />
            <h1 className="display splash-title"><Typed text="TELSIZ" start={300} step={90} /></h1>
            <div className="splash-rule" />
            {phase !== "show" && <p className="splash-credit"><TypedCredit start={150} /></p>}
            {phase !== "show" && <div className="eq" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>}
            {phase !== "show" && user !== undefined && (
              user ? (
                <button type="button" className="continue-btn" onClick={() => setPhase("out")}>{t("continue")}</button>
              ) : (
                <button type="button" className="continue-btn google" onClick={login}><GoogleG /> {t("googleLogin")}</button>
              )
            )}
            {err && <p className="splash-err" role="alert">{err}</p>}
          </>
        )}
      </div>
      <div className={"splash-langs" + (phase === "show" ? "" : " gone")}>
        <div className="pick-hint"><span>Dil seçiniz</span><span>Wybierz język</span><span>Select language</span></div>
        <div className="lang-row">
          {LANGS.map((l) => (
            <button key={l.code} className="lang-pick-btn" onClick={(e) => choose(e, l.code)}>{l.name}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
