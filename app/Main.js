"use client";
import { useEffect, useRef, useState } from "react";
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { enablePush, notifyUser, pushSupported } from "@/lib/push";
import { listenLive, liveSupported, startLive } from "@/lib/live";
import { useI18n } from "@/lib/i18n";
import { Avatar, Icon, LangSwitch, VoiceMsg } from "./ui";

const chatIdOf = (a, b) => [a, b].sort().join("_");

export default function Main({ user, onLogout }) {
  const { t } = useI18n();
  const liveAudio = useRef(null);
  const friendsRef = useRef([]);
  const [speaker, setSpeaker] = useState(null);
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
    const el = (liveAudio.current = new Audio());
    el.autoplay = true;
    el.playsInline = true;
    const unlock = () => {
      el.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      el.play().catch(() => {}).finally(() => { el.removeAttribute("src"); el.load(); });
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Canlı telsiz: gelen yayını dinle
  useEffect(() => {
    if (!liveSupported() || !liveAudio.current) return;
    return listenLive(user.uid, liveAudio.current, (from) => {
      if (!from) return setSpeaker(null);
      const f = friendsRef.current.find((x) => x.uid === from);
      setSpeaker(f?.name || t("friend"));
    });
  }, [user.uid]);

  // Çevrimiçi / odada durumu: düzenli kalp atışı
  useEffect(() => {
    const room = active ? chatIdOf(user.uid, active.uid) : "";
    const ref = doc(db, "users", user.uid);
    const beat = (r) =>
      setDoc(ref, { lastSeen: serverTimestamp(), room: r }, { merge: true }).catch(() => {});
    const tick = () => beat(document.visibilityState === "visible" ? room : "");
    tick();
    const iv = setInterval(tick, 20000);
    const leave = () => beat("");
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pagehide", leave);
    };
  }, [active, user.uid]);

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
            return { id: d.id, name: u.data()?.name || u.data()?.email || "", photo: u.data()?.photo };
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
            return { id: d.id, from: d.data().from, name: u.data()?.name || "", photo: u.data()?.photo };
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
            name: u.data()?.name || "",
            email: u.data()?.email || "",
            photo: u.data()?.photo || "",
            lastAt: d.data().lastAt?.toMillis?.() || 0,
            lastFrom: d.data().lastFrom || "",
            lastKind: d.data().lastKind || "",
          };
        })
      );
      list.sort((a, b) => b.lastAt - a.lastAt);
      friendsRef.current = list;
      setFriends(list);
    });
  }, [user.uid]);

  async function sendRequest(e) {
    e?.preventDefault();
    setInfo("");
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    if (addr === (user.email || "").toLowerCase()) return setInfo(t("ownAddress"));
    try {
      const snap = await getDocs(query(collection(db, "users"), where("email", "==", addr), limit(1)));
      if (snap.empty) return setInfo(t("noUser"));
      const target = snap.docs[0].id;
      if (friends.some((f) => f.uid === target)) return setInfo(t("alreadyFriends"));
      if (incoming.some((r) => r.from === target)) return setInfo(t("alreadyRequested"));
      await setDoc(doc(db, "requests", `${user.uid}_${target}`), {
        from: user.uid, to: target, status: "pending", createdAt: serverTimestamp(),
      });
      setEmail("");
      setInfo(t("requestSent"));
    } catch (err) {
      setInfo(t("requestFail", { e: err.code || err.message }));
    }
  }

  async function accept(r) {
    try {
      await setDoc(doc(db, "chats", chatIdOf(user.uid, r.from)), {
        members: [user.uid, r.from], createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "requests", r.id), { status: "accepted" });
    } catch (err) {
      setInfo(t("acceptFail", { e: err.code || err.message }));
    }
  }

  const preview = (f) =>
    !f.lastAt ? f.email : (f.lastFrom === user.uid ? t("you") : "") + (f.lastKind === "voice" ? t("voiceMsg") : t("message"));

  return (
    <div className={"app" + (active ? " inchat" : "")}>
      <aside className="side">
        <header className="side-head">
          <Avatar name={user.displayName || user.email} photo={user.photoURL} size={36} />
          <span className="who">{user.displayName || user.email}</span>
          {notif === "default" && (
            <button className="icon-btn accent" onClick={turnOnNotif} aria-label={t("notifOn")} title={t("notifOn")}>
              <Icon name="bell" />
            </button>
          )}
          {notif === "denied" && (
            <span className="icon-btn" title={t("notifBlocked")} aria-label={t("notifBlocked")}>
              <Icon name="bellOff" />
            </span>
          )}
          <button className="icon-btn" onClick={onLogout} aria-label={t("logout")} title={t("logout")}>
            <Icon name="logout" />
          </button>
        </header>

        <div className="list">
          {notif === "unsupported" && (
            <p className="empty">{t("iosHint")}</p>
          )}

          {incoming.length > 0 && <div className="section-label">{t("requests")}</div>}
          {incoming.map((r) => (
            <div className="item" key={r.id}>
              <Avatar name={r.name || t("someone")} photo={r.photo} />
              <div className="meta">
                <div className="name">{r.name || t("someone")}</div>
                <div className="sub">{t("wantsFriend")}</div>
              </div>
              <button className="btn-sm" onClick={() => accept(r)}>{t("accept")}</button>
            </div>
          ))}

          <div className="section-label">{t("chats")}</div>
          {friends.length === 0 && (
            <p className="empty">{t("noFriends")}</p>
          )}
          {friends.map((f) => (
            <button
              key={f.uid}
              className={"item" + (active?.uid === f.uid ? " active" : "")}
              onClick={() => setActive(f)}
            >
              <Avatar name={f.name || t("friend")} photo={f.photo} />
              <div className="meta">
                <div className="name" style={isUnread(f) ? { fontWeight: 600 } : undefined}>{f.name || t("friend")}</div>
                <div className="sub">{preview(f)}</div>
              </div>
              {isUnread(f) && <span className="dot" aria-label={t("unread")} />}
            </button>
          ))}

          {outgoing.length > 0 && <div className="section-label">{t("pending")}</div>}
          {outgoing.map((r) => (
            <div className="item" key={r.id}>
              <Avatar name={r.name || t("someone")} photo={r.photo} />
              <div className="meta">
                <div className="name">{r.name || t("someone")}</div>
                <div className="sub">{t("waitingAccept")}</div>
              </div>
              <span className="muted"><Icon name="clock" size={18} /></span>
            </div>
          ))}
        </div>

        <div className="add">
          {!addOpen ? (
            <button className="add-toggle" onClick={() => setAddOpen(true)}>
              <Icon name="userPlus" /> {t("addFriend")}
            </button>
          ) : (
            <form className="add-form" onSubmit={sendRequest}>
              <input
                className="field"
                type="email"
                placeholder={t("gmail")}
                value={email}
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn-sm" type="submit">{t("add")}</button>
            </form>
          )}
          {info && <p className="info" role="status">{info}</p>}
          <div className="add-row" style={{ paddingTop: 8 }}><LangSwitch /></div>
        </div>
      </aside>

      {speaker && (
        <div className="live-banner" role="status">
          <span className="rec-dot" /> {t("speaking", { name: speaker })}
        </div>
      )}

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
            <p>{t("pickChat")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Chat({ me, friend, onBack, onRead }) {
  const { t, locale } = useI18n();
  const chatId = chatIdOf(me.uid, friend.uid);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [rec, setRec] = useState(false);
  const [sec, setSec] = useState(0);
  const [err, setErr] = useState("");
  const [liveState, setLiveState] = useState("");
  const [presence, setPresence] = useState(null);
  const [now, setNow] = useState(Date.now());
  const endRef = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const startedAt = useRef(0);
  const limitTimer = useRef(null);
  const first = useRef(true);
  const pressed = useRef(false);
  const liveRef = useRef(null);
  const statusRef = useRef("offline");

  // Arkadaşın çevrimiçi / odada durumu
  useEffect(() => {
    const un = onSnapshot(doc(db, "users", friend.uid), (d) => setPresence(d.data() || null));
    const iv = setInterval(() => setNow(Date.now()), 15000);
    return () => { un(); clearInterval(iv); };
  }, [friend.uid]);

  const seen = presence?.lastSeen?.toMillis?.() || 0;
  const status = !seen || now - seen > 70000 ? "offline" : presence?.room === chatId ? "room" : "online";
  statusRef.current = status;
  const statusLabel = { room: t("stInRoom"), online: t("stOnline"), offline: t("stOffline") }[status];

  useEffect(() => {
    first.current = true;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(200));
    return onSnapshot(q, (snap) => {
      setMsgs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      // Canlı yayınla zaten dinlenmeyen sesli mesajı otomatik çal
      if (!first.current) {
        snap.docChanges().forEach((c) => {
          const m = c.doc.data();
          if (c.type === "added" && m.from !== me.uid && m.type === "voice" && m.audio && !m.live) {
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
    const i = setInterval(() => setSec(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(i);
  }, [rec]);

  async function afterSend(kind, quiet) {
    await updateDoc(doc(db, "chats", chatId), { lastAt: serverTimestamp(), lastFrom: me.uid, lastKind: kind });
    if (!quiet) notifyUser(friend.uid, me.displayName || "Telsiz", kind === "voice" ? t("voiceMsg") : t("newMessage"));
  }

  async function sendText(e) {
    e?.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText("");
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        from: me.uid, type: "text", text: v, createdAt: serverTimestamp(),
      });
      afterSend("text");
    } catch (er) {
      setErr(t("sendFail", { e: er.code || er.message }));
    }
  }

  async function startRec(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setErr("");
    pressed.current = true;
    setLiveState("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!pressed.current) { // izin penceresi sırasında bırakıldı
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      chunks.current = [];
      mr.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const lv = liveRef.current;
        liveRef.current = null;
        const wasLive = !!lv?.answered;
        lv?.stop();
        setLiveState("");
        if (Date.now() - startedAt.current < 500) return; // yanlışlıkla dokunma
        const blob = new Blob(chunks.current, { type: mr.mimeType });
        if (blob.size > 700_000) return setErr(t("tooLong"));
        const audio = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
        try {
          await addDoc(collection(db, "chats", chatId, "messages"), {
            from: me.uid, type: "voice", audio, live: wasLive, createdAt: serverTimestamp(),
          });
          afterSend("voice", wasLive);
        } catch (er) {
          setErr(t("voiceFail", { e: er.code || er.message }));
        }
      };
      recorder.current = mr;
      startedAt.current = Date.now();
      mr.start();
      setRec(true);
      limitTimer.current = setTimeout(stopRec, 60000);
      // Arkadaş çevrimiçiyse sesi canlı yolla
      if (liveSupported() && statusRef.current !== "offline") {
        startLive({ from: me.uid, to: friend.uid, stream, onState: setLiveState })
          .then((lv) => {
            if (recorder.current !== mr || mr.state !== "recording") lv.stop();
            else liveRef.current = lv;
          })
          .catch(() => setLiveState(""));
      }
    } catch {
      setErr(t("micNeeded"));
    }
  }

  function stopRec() {
    pressed.current = false;
    clearTimeout(limitTimer.current);
    if (recorder.current && recorder.current.state === "recording") recorder.current.stop();
    setRec(false);
  }

  const clock = (m) => m.createdAt?.toDate?.().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const recLabel = liveState === "live" ? t("live") : liveState === "connecting" ? t("connecting") : t("releaseSend");

  return (
    <>
      <header className="chat-head">
        <button className="icon-btn back" onClick={onBack} aria-label={t("backToList")}>
          <Icon name="back" />
        </button>
        <Avatar name={friend.name || t("friend")} photo={friend.photo} size={36} />
        <div className="head-text">
          <span className="title">{friend.name || t("friend")}</span>
          <span className={"status " + status}><span className="sd" />{statusLabel}</span>
        </div>
      </header>

      <div className="msgs">
        {msgs.length === 0 && (
          <div className="chat-empty">
            <Icon name="mic" size={28} />
            <p>{t("emptyChat")}</p>
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
              <span className="muted">{recLabel}</span>
            </div>
          ) : (
            <>
              <input
                className="field"
                placeholder={t("writeMsg")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label={t("message")}
              />
              <button className="send" type="submit" aria-label={t("sendBtn")} disabled={!text.trim()} style={!text.trim() ? { opacity: 0.45 } : undefined}>
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
            aria-label={t("holdToTalk")}
            title={t("holdToTalk")}
          >
            <Icon name="mic" size={24} />
          </button>
        </form>
        {!rec && <p className="hint">{t("hint")}</p>}
      </div>
    </>
  );
}
