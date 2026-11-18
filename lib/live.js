import {
  arrayUnion, Bytes, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// STUN + herkese açık ücretsiz TURN yedeği (katı ağlar için). Daha güvenilir bir TURN ekleyince buraya yazılır.
export const RTC = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: ["turn:freeturn.net:3478", "turns:freeturn.tel:5349"], username: "free", credential: "free" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

// Doğrudan sesi gerçekten çalınan gönderenler (aynı ses yedek yoldan da gelirse tekrar çalınmasın)
const liveHeard = new Set();

export const liveSupported = () => typeof window !== "undefined" && "RTCPeerConnection" in window;

// GÖNDEREN: mikrofon akışını arkadaşına canlı yollar. Firestore "live/{id}" belgesi sinyal kanalıdır.
export async function startLive({ from, to, stream, onState }) {
  const pc = new RTCPeerConnection(RTC);
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  const ref = doc(collection(db, "live"));
  const pending = [];
  let created = false;
  let answered = false;
  let heard = false;
  let connected = false;
  let applied = 0;
  let chain = Promise.resolve();

  const pushIce = (c) =>
    created
      ? updateDoc(ref, { offerIce: arrayUnion(c) }).catch(() => {})
      : pending.push(c);
  pc.onicecandidate = (e) => e.candidate && pushIce(JSON.stringify(e.candidate));
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      connected = true;
      onState?.("live");
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await setDoc(ref, {
    from, to, status: "open", offer: { type: offer.type, sdp: offer.sdp },
    offerIce: [], answerIce: [], createdAt: serverTimestamp(),
  });
  created = true;
  pending.splice(0).forEach(pushIce);
  onState?.("connecting");

  const unsub = onSnapshot(ref, (snap) => {
    const d = snap.data();
    if (!d) return;
    heard = d.playing === true;
    chain = chain.then(async () => {
      if (d.answer && !answered) {
        answered = true;
        await pc.setRemoteDescription(d.answer);
      }
      if (answered) {
        const list = d.answerIce || [];
        for (; applied < list.length; applied++) {
          await pc.addIceCandidate(JSON.parse(list[applied])).catch(() => {});
        }
      }
    }).catch(() => {});
  });

  return {
    get answered() { return answered; },
    get heard() { return heard; },
    get state() { return pc.connectionState; },
    get connected() { return connected; },
    async stop() {
      unsub();
      try { await updateDoc(ref, { status: "closed" }); } catch {}
      setTimeout(() => { pc.close(); deleteDoc(ref).catch(() => {}); }, 3000);
    },
  };
}

// ALICI: gelen canlı yayınları dinler, sesi tek bir <audio> elemanından çalar.
export function listenLive(uid, audio, onSpeaking, onBlocked) {
  const sessions = new Map();

  function end(id) {
    const s = sessions.get(id);
    if (!s) return;
    sessions.delete(id);
    liveHeard.delete(s.from);
    try { s.pc.close(); } catch {}
    if (!sessions.size) {
      audio.srcObject = null;
      onSpeaking?.(null);
    }
  }

  function begin(id, d, ref) {
    const pc = new RTCPeerConnection(RTC);
    const s = { pc, ref, from: d.from, applied: 0, started: false, answered: false, chain: Promise.resolve() };
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0] || new MediaStream([e.track]);
      audio.play()
        .then(async () => {
          onBlocked?.(false);
          // Ses paketleri gerçekten geliyor mu? (çalma sözü tek başına yetmez, özellikle iOS'ta)
          await new Promise((r) => setTimeout(r, 700));
          let pk = 0;
          try {
            (await pc.getStats()).forEach((x) => {
              if (x.type === "inbound-rtp" && x.kind === "audio") pk = x.packetsReceived || 0;
            });
          } catch {}
          if (pk >= 8) liveHeard.add(d.from);
          updateDoc(ref, { playing: pk >= 8 }).catch(() => {});
        })
        .catch(() => {
          onBlocked?.(true); // tarayıcı otomatik çalmayı engelledi: kullanıcı dokunmalı
          updateDoc(ref, { playing: false }).catch(() => {});
        });
    };
    pc.onicecandidate = (e) =>
      e.candidate && updateDoc(ref, { answerIce: arrayUnion(JSON.stringify(e.candidate)) }).catch(() => {});
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) end(id);
    };
    sessions.set(id, s);
    return s;
  }

  const unsub = onSnapshot(query(collection(db, "live"), where("to", "==", uid)), (snap) => {
    snap.docChanges().forEach((ch) => {
      const id = ch.doc.id;
      const d = ch.doc.data();
      if (ch.type === "removed" || d.status === "closed") return end(id);
      let s = sessions.get(id);
      if (!s) {
        const ts = d.createdAt?.toMillis?.() ?? Date.now();
        if (d.status !== "open" || Date.now() - ts > 20000) return;
        s = begin(id, d, ch.doc.ref);
      }
      s.chain = s.chain.then(async () => {
        if (!sessions.has(id)) return;
        if (!s.started) {
          s.started = true;
          await s.pc.setRemoteDescription(d.offer);
        }
        const list = d.offerIce || [];
        for (; s.applied < list.length; s.applied++) {
          await s.pc.addIceCandidate(JSON.parse(list[s.applied])).catch(() => {});
        }
        if (!s.answered) {
          s.answered = true;
          const ans = await s.pc.createAnswer();
          await s.pc.setLocalDescription(ans);
          await updateDoc(s.ref, { answer: { type: ans.type, sdp: ans.sdp }, status: "live" });
          onSpeaking?.(d.from);
        }
      }).catch(() => end(id));
    });
  });

  return () => {
    unsub();
    [...sessions.keys()].forEach(end);
  };
}


// ─── YEDEK YOL ───────────────────────────────────────────────────────────────
// Doğrudan bağlantı her ağda kurulamıyor. Bu yol her ağda çalışır: mikrofon sesi
// 16 kHz, 8 bit μ-law olarak ~0,3 sn'lik paketlere bölünüp Firestore'a yazılır;
// alıcı paketleri tek bir AudioContext üzerinde arka arkaya, boşluksuz planlayarak çalar.

const RATE = 16000;
const CHUNK = 4800; // 0,3 sn

let actx = null;
export function getAudioCtx() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state !== "running") actx.resume().catch(() => {});
  } catch {}
  return actx;
}

function ulawEnc(x) {
  let v = Math.max(-1, Math.min(1, x)) * 32767 | 0;
  const sign = v < 0 ? 0x80 : 0;
  if (sign) v = -v;
  v = Math.min(32635, v) + 0x84;
  let exp = 7;
  for (let m = 0x4000; (v & m) === 0 && exp > 0; m >>= 1) exp--;
  return ~(sign | (exp << 4) | ((v >> (exp + 3)) & 0x0f)) & 0xff;
}
const ULAW = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff;
  const exp = (u >> 4) & 7;
  const s = (((u & 0x0f) << 3) + 0x84 << exp) - 0x84;
  ULAW[i] = (u & 0x80 ? -s : s) / 32768;
}

// GÖNDEREN
export function startRelay({ chatId, from, stream }) {
  const ctx = getAudioCtx();
  const col = collection(db, "chats", chatId, "audio");
  const session = Date.now();
  let seq = 0, sent = 0, delivered = 0, stopped = false, level = 0;
  const sentIds = [];
  let buf = new Uint8Array(CHUNK), fill = 0, pos = 0;

  const send = (u8) => {
    const n = seq++;
    const id = `r${session}_${String(n).padStart(5, "0")}`;
    sentIds.push(id);
    setDoc(doc(col, id), {
      relay: true, from, session, seq: n, pcm: Bytes.fromUint8Array(u8), createdAt: serverTimestamp(),
    }).then(() => { sent++; }).catch(() => {});
  };

  // Alıcı paketi alınca siler: silinen paket = ulaşan ses
  const unsub = onSnapshot(query(col, where("session", "==", session)), (snap) => {
    snap.docChanges().forEach((ch) => { if (ch.type === "removed") delivered++; });
  }, () => {});

  let src = null, proc = null, mute = null;
  try {
    src = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(2048, 1, 1);
    mute = ctx.createGain();
    mute.gain.value = 0;
    proc.onaudioprocess = (e) => {
      if (stopped) return;
      const inp = e.inputBuffer.getChannelData(0);
      let pk = 0;
      for (let i = 0; i < inp.length; i += 8) pk = Math.max(pk, Math.abs(inp[i]));
      level = pk;
      const step = e.inputBuffer.sampleRate / RATE;
      const w = Math.max(1, Math.round(step));
      for (; pos < inp.length; pos += step) {
        const i = pos | 0;
        let sum = 0, c = 0;
        for (let k = i; k < i + w && k < inp.length; k++) { sum += inp[k]; c++; }
        buf[fill++] = ulawEnc(sum / c);
        if (fill === CHUNK) { send(buf); buf = new Uint8Array(CHUNK); fill = 0; }
      }
      pos -= inp.length;
    };
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);
  } catch {}

  return {
    get sent() { return sent; },
    get delivered() { return delivered; },
    get level() { return level; },
    stop() {
      if (stopped) return;
      stopped = true;
      try { src?.disconnect(); proc?.disconnect(); mute?.disconnect(); } catch {}
      if (fill > 800) send(buf.slice(0, fill));
      setTimeout(unsub, 6000);
      // Alıcı almadıysa (kapalı/arka plan) artık çöpe dönen parçaları sunucudan temizle
      setTimeout(() => sentIds.forEach((id) => deleteDoc(doc(col, id)).catch(() => {})), 20000);
    },
  };
}

// ALICI
let unlockBound = false;
export function listenRelay({ uid, chatIds, onSpeaking, onBlocked }) {
  if (!unlockBound) {
    unlockBound = true;
    const u = () => getAudioCtx();
    ["pointerdown", "touchend", "keydown"].forEach((ev) => window.addEventListener(ev, u, { passive: true }));
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && actx) u(); });
  }
  const lines = new Map(); // gönderen → { next, lead, session, seq }
  let idle = null;
  let speaking = null;

  function play(d) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state !== "running") onBlocked?.(true);
    else onBlocked?.(false);
    const u8 = d.pcm.toUint8Array();
    const sr = ctx.sampleRate;
    const outN = Math.max(1, Math.round(u8.length * sr / RATE));
    const ab = ctx.createBuffer(1, outN, sr);
    const out = ab.getChannelData(0);
    const r = RATE / sr, last = u8.length - 1;
    for (let i = 0; i < outN; i++) {
      const p = i * r, j = p | 0, f = p - j;
      const a = ULAW[u8[j]], b = ULAW[u8[j < last ? j + 1 : last]];
      out[i] = a + (b - a) * f;
    }
    let ln = lines.get(d.from);
    if (!ln || ln.session !== d.session) {
      ln = { next: 0, lead: ln?.lead || 0.25, session: d.session, seq: -1 };
      lines.set(d.from, ln);
    }
    if (d.seq <= ln.seq) return; // geç gelen eski paket
    ln.seq = d.seq;
    const now = ctx.currentTime;
    if (ln.next < now + 0.01) {
      // Ara verildi: konuşmanın ortasında ise bekleme payını biraz büyüt (ağ dalgalanması)
      if (ln.next > 0) ln.lead = Math.min(0.7, ln.lead + 0.08);
      ln.next = now + ln.lead;
    }
    const node = ctx.createBufferSource();
    node.buffer = ab;
    node.connect(ctx.destination);
    node.start(ln.next);
    ln.next += ab.duration;
    if (speaking !== d.from) { speaking = d.from; onSpeaking?.(d.from); }
    clearTimeout(idle);
    idle = setTimeout(() => { speaking = null; onSpeaking?.(null); }, (ln.next - now) * 1000 + 700);
  }

  const unsubs = chatIds.map((cid) =>
    onSnapshot(query(collection(db, "chats", cid, "audio"), where("relay", "==", true)), (snap) => {
      const fresh = [];
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const d = ch.doc.data();
        if (d.from === uid) return;
        deleteDoc(ch.doc.ref).catch(() => {}); // ulaştı (eski kalıntılar da temizlenir)
        const ts = d.createdAt?.toMillis?.() ?? Date.now();
        if (!d.pcm || Date.now() - ts > 15000) return;
        fresh.push(d);
      });
      fresh.sort((a, b) => a.seq - b.seq).forEach((d) => {
        play(d);
      });
    }, () => {})
  );
  return () => { unsubs.forEach((u) => u()); clearTimeout(idle); };
}
