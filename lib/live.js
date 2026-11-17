import {
  arrayUnion, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// STUN + herkese açık ücretsiz TURN yedeği (katı ağlar için). Daha güvenilir bir TURN ekleyince buraya yazılır.
export const RTC = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
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
    try { s.pc.close(); } catch {}
    if (!sessions.size) {
      audio.srcObject = null;
      onSpeaking?.(null);
    }
  }

  function begin(id, d, ref) {
    const pc = new RTCPeerConnection(RTC);
    const s = { pc, ref, applied: 0, started: false, answered: false, chain: Promise.resolve() };
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

// YEDEK YOL: doğrudan bağlantı (WebRTC) kurulamazsa ses ~1,5 sn'lik küçük parçalar olarak
// Firestore üzerinden gider. Her ağda, her cihaz çiftinde çalışır; gecikme birkaç saniyedir.
const RELAY_MIME = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

export function startRelay({ chatId, from, stream }) {
  const mime = typeof MediaRecorder !== "undefined"
    ? RELAY_MIME.find((m) => MediaRecorder.isTypeSupported?.(m)) : "";
  const col = collection(db, "chats", chatId, "audio");
  const session = Date.now();
  const ids = [];
  let n = 0, sent = 0, stopped = false, rec = null, timer = null;

  const toDataUrl = (blob) => new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(blob);
  });

  function clip() {
    if (stopped) return;
    let r;
    try {
      r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
    } catch { return; }
    const parts = [];
    const seq = n++;
    rec = r;
    r.ondataavailable = (e) => e.data.size && parts.push(e.data);
    r.onstop = async () => {
      if (!parts.length) return;
      const data = await toDataUrl(new Blob(parts, { type: r.mimeType }));
      if (data.length > 600000) return;
      const id = `r${session}_${String(seq).padStart(4, "0")}`;
      ids.push(id);
      try {
        await setDoc(doc(col, id), { relay: true, from, session, seq, data, createdAt: serverTimestamp() });
        sent++;
      } catch {}
    };
    r.start();
    timer = setTimeout(() => {
      if (r.state === "recording") r.stop();
      clip();
    }, 1500);
  }
  clip();

  return {
    get sent() { return sent; },
    stop() {
      stopped = true;
      clearTimeout(timer);
      if (rec && rec.state === "recording") rec.stop();
      setTimeout(() => ids.forEach((id) => deleteDoc(doc(col, id)).catch(() => {})), 20000);
    },
  };
}

// ALICI: sohbetlerdeki yedek ses parçalarını dinler ve sırayla çalar.
export function listenRelay({ uid, chatIds, audio, onSpeaking, onBlocked }) {
  const queue = [];
  let playing = false;
  let idle = null;
  let from = null;
  const seen = new Set();

  function next() {
    if (playing) return;
    const item = queue.shift();
    if (!item) {
      clearTimeout(idle);
      idle = setTimeout(() => { if (!playing && !queue.length) { from = null; onSpeaking?.(null); } }, 3000);
      return;
    }
    clearTimeout(idle);
    playing = true;
    audio.srcObject = null;
    audio.src = item.data;
    audio.onended = () => { playing = false; next(); };
    audio.onerror = () => { playing = false; next(); };
    audio.play().then(() => onBlocked?.(false)).catch(() => onBlocked?.(true));
  }

  const unsubs = chatIds.map((cid) =>
    onSnapshot(query(collection(db, "chats", cid, "audio"), where("relay", "==", true)), (snap) => {
      const fresh = [];
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const d = ch.doc.data();
        if (d.from === uid || seen.has(ch.doc.id)) return;
        const ts = d.createdAt?.toMillis?.() ?? Date.now();
        if (Date.now() - ts > 20000) return;
        seen.add(ch.doc.id);
        fresh.push({ id: ch.doc.id, ref: ch.doc.ref, d });
      });
      if (!fresh.length) return;
      fresh.sort((a, b) => a.d.seq - b.d.seq);
      fresh.forEach((f) => {
        queue.push({ data: f.d.data });
        if (from !== f.d.from) { from = f.d.from; onSpeaking?.(from); }
        deleteDoc(f.ref).catch(() => {});
      });
      next();
    })
  );
  return () => {
    unsubs.forEach((u) => u());
    clearTimeout(idle);
  };
}
