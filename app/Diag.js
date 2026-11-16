"use client";
import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RTC } from "@/lib/live";
import { pushSupported } from "@/lib/push";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui";

const WAV = (() => {
  // 0.35 sn, 880 Hz bip
  const rate = 8000, n = 2800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin((2 * Math.PI * 880 * i) / rate) * 9000, true);
  return buf;
})();

async function iceTypes() {
  const pc = new RTCPeerConnection(RTC);
  pc.createDataChannel("x");
  const types = new Set();
  pc.onicecandidate = (e) => {
    const c = e.candidate;
    if (!c) return;
    types.add(c.type || (/ typ (\w+)/.exec(c.candidate) || [])[1]);
  };
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise((res) => {
    const t = setTimeout(res, 5000);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") { clearTimeout(t); res(); }
    };
  });
  pc.close();
  return types;
}

export default function Diag({ uid, onClose }) {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const out = [];
    const add = (name, state, msg) => { out.push({ name, state, msg }); setRows([...out]); };
    setRows([]);

    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone;
    add(t("dgApp"), standalone ? "ok" : "warn", standalone ? t("dgInstalled") : t("dgBrowser"));

    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((x) => x.stop());
      add(t("dgMic"), "ok", t("dgMicOk"));
    } catch (e) {
      add(t("dgMic"), "bad", t("dgMicFail") + " (" + (e.name || "") + ")");
    }

    try {
      const a = new Audio(URL.createObjectURL(new Blob([WAV], { type: "audio/wav" })));
      await a.play();
      add(t("dgSound"), "ok", t("dgBeep"));
    } catch (e) {
      add(t("dgSound"), "bad", t("dgSoundFail"));
    }

    if (!pushSupported()) add(t("dgNotif"), "warn", t("dgNotifNo"));
    else if (Notification.permission !== "granted") add(t("dgNotif"), "bad", t("dgNotifOff"));
    else {
      let has = false;
      try { has = !!(await (await navigator.serviceWorker.getRegistration("/sw.js"))?.pushManager.getSubscription()); } catch {}
      add(t("dgNotif"), has ? "ok" : "warn", has ? t("dgNotifOk") : t("dgNotifNoSub"));
    }

    try {
      await getDoc(doc(db, "users", uid));
      add(t("dgFs"), "ok", t("dgFsOk"));
    } catch (e) {
      add(t("dgFs"), "bad", t("dgFsFail") + " (" + (e.code || "") + ")");
    }

    try {
      const ty = await iceTypes();
      const list = [...ty].join(", ");
      if (ty.has("relay")) add(t("dgNet"), "ok", t("dgNetOk") + " [" + list + "]");
      else if (ty.has("srflx")) add(t("dgNet"), "ok", t("dgNetStun") + " [" + list + "]");
      else add(t("dgNet"), "bad", t("dgNetBad") + " [" + list + "]");
    } catch (e) {
      add(t("dgNet"), "bad", t("dgNetBad"));
    }
    setBusy(false);
  }

  const color = { ok: "#16a34a", warn: "#d97706", bad: "var(--danger)" };
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="diag-box" role="dialog" aria-label={t("dgTitle")} onClick={(e) => e.stopPropagation()}>
        <h2>{t("dgTitle")}</h2>
        <ul className="diag-list">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="diag-dot" style={{ background: color[r.state] }} />
              <div><strong>{r.name}</strong><div className="muted">{r.msg}</div></div>
            </li>
          ))}
          {!rows.length && <li className="muted">{t("dgIntro")}</li>}
        </ul>
        <div className="diag-actions">
          <button className="btn-sm" onClick={run} disabled={busy}>{busy ? "…" : t("dgRun")}</button>
          <button className="sheet-cancel" onClick={onClose}>{t("dgClose")}</button>
        </div>
      </div>
    </div>
  );
}
