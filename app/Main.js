"use client";
import { useEffect, useRef, useState } from "react";
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { enablePush, notifyUser, pushSupported } from "@/lib/push";
import { Avatar, Icon, VoiceMsg } from "./ui";

const chatIdOf = (a, b) => [a, b].sort().join("_");

export default function Main({ user, onLogout }) {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [, setTick] = useState(0);
  const [notif, setNotif] = useState("default");

  // İlk dokunuşta sesi aç: sonra gelen sesli mesaj otomatik çalabilsin
  useEffect(() => {
    const unlock = () => {
      new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=").play().catch(() => {});
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

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

  // Gönderdiğim, bekleyen istekler
  useEffect(() => {
    const q = query(collection(db, "requests"), where("from", "==", user.uid), where("status", "==", "pending"));
    return onSnapshot(q, async (snap) => {
      setOutgoing(
        await Promise.all(
          snap.docs.map(async (d) => {
            const u = await getDoc(doc(db, "users", d.data().to));
            return { id: d.id, name: u.data()?.name || u.data()?.email || "Biri", photo: u.data()?.photo };
          })
        )
      );
    });
  }, [user.uid]);

  // Bana gelen istekler
  useEffect(() => {
    const q = query(collection(db, "requests"), where("to", "==", user.uid), where("status", "==", "pending"));
    return onSnapshot(q, async (snap) => {
      setIncoming(
        await Promise.all(
          snap.docs.map(async (d) => {
            const u = await getDoc(doc(db, "users", d.data().from));
            return { id: d.id, from: d.data().from, name: u.data()?.name || "Biri", photo: u.data()?.photo };
          })
        )
      );
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
            photo: u.data()?.photo || "",
            lastAt: d.data().lastAt?.toMillis?.() || 0,
            lastFrom: d.data().lastFrom || "",
            lastKind: d.data().lastKind || "",
          };
        })
      );
      list.sort((a, b) => b.lastAt - a.lastAt);
      setFriends(list);
    });
  }, [user.uid]);

  async function sendRequest(e) {
    e?.preventDefault();
    setInfo("");
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    if (addr === (user.email || "").toLowerCase()) return setInfo("Bu senin adresin.");
    try {
      const snap = await getDocs(query(collection(db, "users"), where("email", "==", addr), limit(1)));
      if (snap.empty) return setInfo("Bu adresle kayıtlı kullanıcı yok. Önce uygulamaya Google ile girmesi gerekir.");
      const target = snap.docs[0].id;
      if (friends.some((f) => f.uid === target)) return setInfo("Zaten arkadaşsınız.");
      if (incoming.some((r) => r.from === target)) return setInfo("Bu kişi sana zaten istek göndermiş. Soldan kabul edebilirsin.");
      await setDoc(doc(db, "requests", `${user.uid}_${target}`), {
        from: user.uid, to: target, status: "pending", createdAt: serverTimestamp(),
      });
      setEmail("");
      setInfo("İstek gönderildi.");
    } catch (err) {
      setInfo("İstek gönderilemedi: " + (err.code || err.message));
    }
  }

  async function accept(r) {
    try {
      await setDoc(doc(db, "chats", chatIdOf(user.uid, r.from)), {
        members: [user.uid, r.from], createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "requests", r.id), { status: "accepted" });
    } catch (err) {
      setInfo("Kabul edilemedi: " + (err.code || err.message));
    }
  }

  const preview = (f) =>
    !f.lastAt ? f.email : (f.lastFrom === user.uid ? "Sen: " : "") + (f.lastKind === "voice" ? "Sesli mesaj" : "Mesaj");

  return (
    <div className={"app" + (active ? " inchat" : "")}>
      <aside className="side">
        <header className="side-head">
          <Avatar name={user.displayName || user.email} photo={user.photoURL} size={36} />
          <span className="who">{user.displayName || user.email}</span>
          {notif === "default" && (
            <button className="icon-btn accent" onClick={turnOnNotif} aria-label="Bildirimleri aç" title="Bildirimleri aç">
              <Icon name="bell" />
            </button>
          )}
          {notif === "denied" && (
            <span className="icon-btn" title="Bildirimler tarayıcıda engelli" aria-label="Bildirimler engelli">
              <Icon name="bellOff" />
            </span>
          )}
          <button className="icon-btn" onClick={onLogout} aria-label="Çıkış yap" title="Çıkış yap">
            <Icon name="logout" />
          </button>
        </header>

        <div className="list">
          {notif === "unsupported" && (
            <p className="empty">iPhone'da bildirim için siteyi Paylaş menüsünden "Ana Ekrana Ekle" ile kur.</p>
          )}

          {incoming.length > 0 && <div className="section-label">İstekler</div>}
          {incoming.map((r) => (
            <div className="item" key={r.id}>
              <Avatar name={r.name} photo={r.photo} />
              <div className="meta">
                <div className="name">{r.name}</div>
                <div className="sub">Arkadaş olmak istiyor</div>
              </div>
              <button className="btn-sm" onClick={() => accept(r)}>Kabul et</button>
            </div>
          ))}

          <div className="section-label">Sohbetler</div>
          {friends.length === 0 && (
            <p className="empty">Henüz arkadaşın yok. Aşağıdan Gmail adresiyle ekle.</p>
          )}
          {friends.map((f) => (
            <button
              key={f.uid}
              className={"item" + (active?.uid === f.uid ? " active" : "")}
              onClick={() => setActive(f)}
            >
              <Avatar name={f.name} photo={f.photo} />
              <div className="meta">
                <div className="name" style={isUnread(f) ? { fontWeight: 600 } : undefined}>{f.name}</div>
                <div className="sub">{preview(f)}</div>
              </div>
              {isUnread(f) && <span className="dot" aria-label="Okunmamış mesaj" />}
            </button>
          ))}

          {outgoing.length > 0 && <div className="section-label">Bekleyen istekler</div>}
          {outgoing.map((r) => (
            <div className="item" key={r.id}>
              <Avatar name={r.name} photo={r.photo} />
              <div className="meta">
                <div className="name">{r.name}</div>
                <div className="sub">Kabul etmesi bekleniyor</div>
              </div>
              <span className="muted"><Icon name="clock" size={18} /></span>
            </div>
          ))}
        </div>

        <div className="add">
          {!addOpen ? (
            <button className="add-toggle" onClick={() => setAddOpen(true)}>
              <Icon name="userPlus" /> Arkadaş ekle
            </button>
          ) : (
            <form className="add-form" onSubmit={sendRequest}>
              <input
                className="field"
                type="email"
                placeholder="Gmail adresi"
                value={email}
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn-sm" type="submit">Ekle</button>
            </form>
          )}
          {info && <p className="info" role="status">{info}</p>}
        </div>
      </aside>

      <section className="chat">
        {active ? (
          <Chat
            key={active.uid}
            me={user}
            friend={active}
            onBack={() => setActive(null)}
            onRead={() => setTick((t) => t + 1)}
          />
        ) : (
          <div className="pick">
            <p>Bir sohbet seç. Mikrofon düğmesine basılı tutarak sesli mesaj gönderebilirsin.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Chat({ me, friend, onBack, onRead }) {
  const chatId = chatIdOf(me.uid, friend.uid);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [rec, setRec] = useState(false);
  const [sec, setSec] = useState(0);
  const [err, setErr] = useState("");
  const endRef = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const startedAt = useRef(0);
  const limitTimer = useRef(null);
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

  useEffect(() => {
    if (!rec) return;
    setSec(0);
    const t = setInterval(() => setSec(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [rec]);

  async function afterSend(kind) {
    await updateDoc(doc(db, "chats", chatId), { lastAt: serverTimestamp(), lastFrom: me.uid, lastKind: kind });
    notifyUser(friend.uid, me.displayName || "Telsiz", kind === "voice" ? "Sesli mesaj" : "Yeni mesaj");
  }

  async function sendText(e) {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        from: me.uid, type: "text", text: t, createdAt: serverTimestamp(),
      });
      afterSend("text");
    } catch (er) {
      setErr("Mesaj gönderilemedi: " + (er.code || er.message));
    }
  }

  async function startRec(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (Date.now() - startedAt.current < 500) return; // yanlışlıkla dokunma
        const blob = new Blob(chunks.current, { type: mr.mimeType });
        if (blob.size > 700_000) return setErr("Kayıt çok uzun. En fazla 30 saniye kaydedebilirsin.");
        const audio = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
        try {
          await addDoc(collection(db, "chats", chatId, "messages"), {
            from: me.uid, type: "voice", audio, createdAt: serverTimestamp(),
          });
          afterSend("voice");
        } catch (er) {
          setErr("Sesli mesaj gönderilemedi: " + (er.code || er.message));
        }
      };
      recorder.current = mr;
      startedAt.current = Date.now();
      mr.start();
      setRec(true);
      limitTimer.current = setTimeout(stopRec, 30000);
    } catch {
      setErr("Mikrofon izni gerekli. Tarayıcı adres çubuğundan mikrofona izin ver.");
    }
  }

  function stopRec() {
    clearTimeout(limitTimer.current);
    if (recorder.current && recorder.current.state === "recording") recorder.current.stop();
    setRec(false);
  }

  const clock = (m) => m.createdAt?.toDate?.().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <header className="chat-head">
        <button className="icon-btn back" onClick={onBack} aria-label="Sohbet listesine dön">
          <Icon name="back" />
        </button>
        <Avatar name={friend.name} photo={friend.photo} size={36} />
        <span className="title">{friend.name}</span>
      </header>

      <div className="msgs">
        {msgs.length === 0 && (
          <div className="chat-empty">
            <Icon name="mic" size={28} />
            <p>Henüz mesaj yok. Yaz ya da mikrofon düğmesine basılı tutup konuş.</p>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={"msg" + (m.from === me.uid ? " me" : "")}>
            {m.type === "voice" ? <VoiceMsg src={m.audio} id={m.id} /> : m.text}
            <span className="time">{clock(m)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {err && (
          <p className="err" role="alert" style={{ paddingBottom: 8 }}>
            <Icon name="alert" size={16} /> <span>{err}</span>
          </p>
        )}
        <form className="composer-row" onSubmit={sendText}>
          {rec ? (
            <div className="rec-bar" role="status">
              <span className="rec-dot" />
              <span className="rec-time">{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}</span>
              <span className="muted">Bırakınca gönderilir</span>
            </div>
          ) : (
            <>
              <input
                className="field"
                placeholder="Mesaj yaz"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Mesaj"
              />
              <button className="send" type="submit" aria-label="Gönder" disabled={!text.trim()} style={!text.trim() ? { opacity: 0.45 } : undefined}>
                <Icon name="send" />
              </button>
            </>
          )}
          <button
            type="button"
            className={"ptt" + (rec ? " rec" : "")}
            onPointerDown={startRec}
            onPointerUp={stopRec}
            onPointerCancel={stopRec}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Basılı tutarak konuş"
            title="Basılı tutarak konuş"
          >
            <Icon name="mic" size={24} />
          </button>
        </form>
        {!rec && <p className="hint">Mikrofon düğmesine basılı tut, bırakınca gönderilir.</p>}
      </div>
    </>
  );
}
