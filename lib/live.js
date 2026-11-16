import {
  arrayUnion, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const RTC = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
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
    get connected() { return connected; },
    async stop() {
      unsub();
      try { await updateDoc(ref, { status: "closed" }); } catch {}
      setTimeout(() => { pc.close(); deleteDoc(ref).catch(() => {}); }, 3000);
    },
  };
}

// ALICI: gelen canlı yayınları dinler, sesi tek bir <audio> elemanından çalar.
export function listenLive(uid, audio, onSpeaking) {
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
        .then(() => updateDoc(ref, { playing: true }).catch(() => {}))
        .catch(() => updateDoc(ref, { playing: false }).catch(() => {}));
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
