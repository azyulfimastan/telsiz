"use client";
import { useEffect, useRef, useState } from "react";
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { enablePush, notifyUser, pushSupported } from "@/lib/push";

const chatIdOf = (a, b) => [a, b].sort().join("_");

export default function Main({ user, onLogout }) {
  const [friends, setFriends] = useState([]); // {uid, name, email}
  const [incoming, setIncoming] = useState([]); // {id, from, fromName}
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  const [active, setActive] = useState(null);
  const [, setTick] = useState(0);
  const [notif, setNotif] = useState("default");

  useEffect(() => {
    if (!pushSupported()) return setNotif("unsupported");
    setNotif(Notification.permission);
    if (Notification.permission === "granted") enablePush(user.uid, { ask: false }).catch(() => {});
  }, [user.uid]);

  async function turnOnNotif() {
    try { setNotif(await enablePush(user.uid)); } catch { setNotif("denied"); }
  }

  const readAt = (uid) => Number(localStorage.getItem("read_" + chatIdOf(user.uid, uid)) || 0);
  const isUnread = (f) => f.lastFrom && f.lastFrom !== user.uid && f.lastAt > readAt(f.uid);

  // Gelen istekler
  useEffect(() => {
    const q = query(collection(db, "requests"), where("to", "==", user.uid), where("status", "==", "pending"));
    return onSnapshot(q, async (snap) => {
      const list = await Promise.all(
        snap.docs.map(async (d) => {
          const u = await getDoc(doc(db, "users", d.data().from));
          return { id: d.id, from: d.data().from, fromName: u.data()?.name || "Biri" };
        })
      );
      setIncoming(list);
    });
  }, [user.uid]);

  // Arkadaşlar (kabul edilmiş sohbetler)
  useEffect(() => {
    const q = query(collection(db, "chats"), where("members", "array-contains", user.uid));
    return onSnapshot(q, async (snap) => {
      const list = await Promise.all(
        snap.docs.map(async (d) => {
          const other = d.data().members.find((m) => m !== user.uid);
          const u = await getDoc(doc(db, "users", other));
          return {
            uid: other,
            name: u.data()?.name || "Arkadaş",
            email: u.data()?.email || "",
            lastAt: d.data().lastAt?.toMillis?.() || 0,
            lastFrom: d.data().lastFrom || "",
          };
        })
      );
      list.sort((a, b) => b.lastAt - a.lastAt);
      setFriends(list);
    });
  }, [user.uid]);

  async function sendRequest() {
    setInfo("");
    const e = email.trim().toLowerCase();
    if (!e) return;
    if (e === (user.email || "").toLowerCase()) return setInfo("Bu sensin 🙂");
    const snap = await getDocs(query(collection(db, "users"), where("email", "==", e), limit(1)));
    if (snap.empty) return setInfo("Bu e-postayla kayıtlı kullanıcı yok (önce uygulamaya girmesi lazım).");
    const target = snap.docs[0].id;
    await setDoc(doc(db, "requests", `${user.uid}_${target}`), {
      from: user.uid, to: target, status: "pending", createdAt: serverTimestamp(),
    });
    setEmail("");
    setInfo("İstek gönderildi ✅");
  }

  async function accept(r) {
    await setDoc(doc(db, "chats", chatIdOf(user.uid, r.from)), {
      members: [user.uid, r.from], createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "requests", r.id), { status: "accepted" });
  }

  return (
    <div className={"app" + (active ? " inchat" : "")}>
      <aside className="side">
        <header>
          <strong>📻 {user.displayName?.split(" ")[0] || "Telsiz"}</strong>
          <span style={{ display: "flex", gap: 6 }}>
            {notif === "default" && <button className="primary" onClick={turnOnNotif}>🔔 Bildirim aç</button>}
            {notif === "denied" && <small className="muted">🔕 Bildirim engelli</small>}
            <button onClick={onLogout}>Çıkış</button>
          </span>
        </header>
        {notif === "unsupported" && (
          <p className="muted" style={{ padding: "6px 14px" }}>
            Bildirim için iPhone'da siteyi "Ana ekrana ekle" ile kur.
          </p>
        )}
        <div className="list">
          {incoming.map((r) => (
            <div className="row" key={r.id}>
              <span>{r.fromName} arkadaş olmak istiyor</span>
              <button className="primary" onClick={() => accept(r)}>Kabul</button>
            </div>
          ))}
          {friends.length === 0 && <p className="muted" style={{ padding: 8 }}>Henüz arkadaş yok. Aşağıdan e-posta ile ekle.</p>}
          {friends.map((f) => (
            <div key={f.uid} className={"row" + (active?.uid === f.uid ? " active" : "")} onClick={() => setActive(f)} style={{ cursor: "pointer" }}>
              <span>{isUnread(f) && "🔴 "}{f.name}<br /><small>{f.email}</small></span>
            </div>
          ))}
        </div>
        <div className="add">
          <input placeholder="Arkadaşın Gmail adresi" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="primary" onClick={sendRequest}>Ekle</button>
        </div>
        {info && <p className="muted" style={{ padding: "0 10px 10px" }}>{info}</p>}
      </aside>
      <section className="chat">
        {active ? <Chat key={active.uid} me={user} friend={active} onBack={() => setActive(null)} onRead={() => setTick((t) => t + 1)} /> : <div className="center muted">Bir arkadaş seç</div>}
      </section>
    </div>
  );
}

function Chat({ me, friend, onBack, onRead }) {
  const chatId = chatIdOf(me.uid, friend.uid);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [rec, setRec] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const startedAt = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    first.current = true;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(200));
    return onSnapshot(q, (snap) => {
      setMsgs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      // Telsiz: sonradan gelen sesli mesajı otomatik çal
      if (!first.current) {
        snap.docChanges().forEach((c) => {
          const m = c.doc.data();
          if (c.type === "added" && m.from !== me.uid && m.type === "voice" && m.audio) {
            new Audio(m.audio).play().catch(() => {});
          }
        });
      }
      first.current = false;
    });
  }, [chatId, me.uid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    localStorage.setItem("read_" + chatId, String(Date.now()));
    onRead?.();
  }, [msgs]);

  async function afterSend(kind) {
    await updateDoc(doc(db, "chats", chatId), { lastAt: serverTimestamp(), lastFrom: me.uid, lastKind: kind });
    notifyUser(friend.uid, me.displayName || "Telsiz", kind === "voice" ? "🎙️ Sesli mesaj" : "💬 Yeni mesaj");
  }

  async function sendText() {
    const t = text.trim();
    if (!t) return;
    setText("");
    await addDoc(collection(db, "chats", chatId, "messages"), {
      from: me.uid, type: "text", text: t, createdAt: serverTimestamp(),
    });
    afterSend("text");
  }

  async function startRec(e) {
    e.preventDefault();
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (Date.now() - startedAt.current < 400) return; // yanlışlıkla dokunma
        const blob = new Blob(chunks.current, { type: mr.mimeType });
        if (blob.size > 700_000) return setErr("Ses çok uzun (en fazla ~30 sn).");
        const audio = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
        await addDoc(collection(db, "chats", chatId, "messages"), {
          from: me.uid, type: "voice", audio, createdAt: serverTimestamp(),
        });
        afterSend("voice");
      };
      recorder.current = mr;
      startedAt.current = Date.now();
      mr.start();
      setRec(true);
      setTimeout(() => stopRec(), 30000);
    } catch {
      setErr("Mikrofon izni gerekli.");
    }
  }

  function stopRec() {
    if (recorder.current && recorder.current.state === "recording") recorder.current.stop();
    setRec(false);
  }

  return (
    <>
      <header>
        <button className="back" onClick={onBack}>←</button>
        <strong style={{ flex: 1 }}>{friend.name}</strong>
      </header>
      <div className="msgs">
        {msgs.map((m) => (
          <div key={m.id} className={"msg" + (m.from === me.uid ? " me" : "")}>
            {m.type === "voice" ? <audio controls src={m.audio} /> : m.text}
            <div className="muted" style={{ fontSize: 11, textAlign: "right" }}>
              {m.createdAt?.toDate?.().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {err && <p className="muted" style={{ padding: "0 14px" }}>{err}</p>}
      <div className="bar">
        <input
          placeholder="Mesaj yaz…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText()}
        />
        <button className="primary" onClick={sendText}>Gönder</button>
        <button
          className={"ptt" + (rec ? " rec" : "")}
          onPointerDown={startRec}
          onPointerUp={stopRec}
          onPointerLeave={stopRec}
          onContextMenu={(e) => e.preventDefault()}
        >
          {rec ? "🔴 Bırak = gönder" : "🎙️ Bas-konuş"}
        </button>
      </div>
    </>
  );
}
