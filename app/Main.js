"use client";
import { useEffect, useRef, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, limit, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { enablePush, notifyUser, pushSupported } from "@/lib/push";
import { getAudioCtx, listenLive, listenRelay, liveSupported, startLive, startRelay } from "@/lib/live";
import { useI18n } from "@/lib/i18n";
import Diag from "./Diag";
import { Credit, Avatar, FastSwitch, Icon, LangSwitch, Logo, ModeSwitch, ThemeSwitch, VoiceMsg } from "./ui";

const chatIdOf = (a, b) => [a, b].sort().join("_");

export default function Main({ user, onLogout }) {
  const { t, locale } = useI18n();
  const liveAudio = useRef(null);
  const friendsRef = useRef([]);
  const activeRef = useRef(null);
  const prevChats = useRef(null);
  const ctxRef = useRef(null);
  const [presence, setPresence] = useState({});
  const [speaker, setSpeaker] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [tab, setTab] = useState("chats");
  const [friends, setFriends] = useState([]);
  const [friendsReady, setFriendsReady] = useState(false);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  const [active, setActive] = useState(null);
  const [, setTick] = useState(0);
  const [notif, setNotif] = useState("default");

  // İlk dokunuşta sesi aç: sonra gelen sesli mesaj otomatik çalabilsin
  useEffect(() => {
    const el = liveAudio.current;
    el.autoplay = true;
    el.playsInline = true;
    // Arka plandaki sekmede de bağlantı donmasın: çok kısık, sürekli çalan bir ses + medya oturumu
    let ka = null;
    const keepAlive = () => {
      if (ka) return;
      try {
        const rate = 8000, n = rate;
        const buf = new ArrayBuffer(44 + n * 2);
        const v = new DataView(buf);
        const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
        w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt ");
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        w(36, "data"); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, 0, true);
        ka = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })));
        ka.loop = true;
        ka.play().catch(() => { ka = null; });
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({ title: "Telsiz", artist: "Canlı telsiz açık" });
        }
      } catch {}
    };
    const unlock = () => {
      try {
        ctxRef.current = getAudioCtx();
      } catch {}
      el.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      el.play().catch(() => {}).finally(() => { el.removeAttribute("src"); el.load(); });
      keepAlive();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const beep = () => {
    try {
      const c = ctxRef.current;
      if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.3);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.32);
    } catch {}
  };

  useEffect(() => { activeRef.current = active; }, [active]);

  // Arkadaşların çevrimiçi durumu
  const friendKey = friends.map((f) => f.uid).join(",");
  useEffect(() => {
    const uns = friends.map((f) =>
      onSnapshot(doc(db, "users", f.uid), (d) =>
        setPresence((p) => ({ ...p, [f.uid]: d.data()?.lastSeen?.toMillis?.() || 0 }))
      )
    );
    const iv = setInterval(() => setTick((x) => x + 1), 20000);
    return () => { uns.forEach((u) => u()); clearInterval(iv); };
  }, [friendKey]);
  const isOnline = (f) => Date.now() - (presence[f.uid] || 0) < 70000;

  // Canlı telsiz: gelen yayını dinle
  useEffect(() => {
    if (!liveSupported() || !liveAudio.current) return;
    return listenLive(user.uid, liveAudio.current, (from) => {
      document.body.classList.toggle("listening", !!from);
      if (!from) return setSpeaker(null);
      const f = friendsRef.current.find((x) => x.uid === from);
      setSpeaker(f?.name || t("friend"));
    }, setBlocked);
  }, [user.uid]);

  // Yedek yol: doğrudan bağlantı kurulamazsa gelen ses parçalarını Firestore'dan çal
  useEffect(() => {
    if (!friendKey) return;
    return listenRelay({
      uid: user.uid,
      chatIds: friendKey.split(",").map((u) => chatIdOf(user.uid, u)),
      onSpeaking: (from) => {
        document.body.classList.toggle("listening", !!from);
        if (!from) return setSpeaker(null);
        const f = friendsRef.current.find((x) => x.uid === from);
        setSpeaker(f?.name || t("friend"));
      },
      onBlocked: setBlocked,
    });
  }, [friendKey, user.uid]);

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

  const isUnread = (f) => f.unread > 0;

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
            unread: d.data()["unread_" + user.uid] || 0,
          };
        })
      );
      list.sort((a, b) => b.lastAt - a.lastAt);
      // Yeni mesaj sesi: başka sohbetteyken veya sekme arka plandayken
      const prev = prevChats.current;
      if (prev) {
        list.forEach((f) => {
          const was = prev[f.uid] || 0;
          const here = activeRef.current?.uid === f.uid && document.visibilityState === "visible";
          if (f.lastAt > was && f.lastFrom && f.lastFrom !== user.uid && !here) beep();
        });
      }
      prevChats.current = Object.fromEntries(list.map((f) => [f.uid, f.lastAt]));
      friendsRef.current = list;
      setFriends(list);
      setFriendsReady(true);
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
      deleteDoc(doc(db, "requests", `${user.uid}_${r.from}`)).catch(() => {});
    } catch (err) {
      setInfo(t("acceptFail", { e: err.code || err.message }));
    }
  }

  const when = (ms) => {
    if (!ms) return "";
    const d = new Date(ms), now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  };

  const preview = (f) =>
    !f.lastAt ? f.email : (f.lastFrom === user.uid ? t("you") : "") + (f.lastKind === "voice" ? t("voiceMsg") : t("message"));

  return (
    <div className={"app" + (active ? " inchat" : "")}>
      <audio ref={liveAudio} playsInline autoPlay style={{ display: "none" }} />
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
          <button className={"icon-btn" + (tab === "settings" ? " accent" : "")} onClick={() => setTab(tab === "settings" ? "chats" : "settings")} aria-label={t("settings")} title={t("settings")}>
            <Icon name={tab === "settings" ? "back" : "gear"} />
          </button>
          <button className="icon-btn" onClick={onLogout} aria-label={t("logout")} title={t("logout")}>
            <Icon name="logout" />
          </button>
        </header>

        {tab === "chats" ? (<>
        <div className="credit-top"><p className="credit-card"><Logo size={22} /> <Credit /></p></div>

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
          {!friendsReady && [0, 1, 2].map((i) => (
            <div className="item sk-item" key={"sk" + i}><i className="sk sk-av" /><div className="meta"><i className="sk sk-l1" /><i className="sk sk-l2" /></div></div>
          ))}
          {friendsReady && friends.length === 0 && (
            <p className="empty">{t("noFriends")}</p>
          )}
          {friends.map((f) => (
            <button
              key={f.uid}
              className={"item" + (active?.uid === f.uid ? " active" : "")}
              onClick={() => setActive(f)}
            >
              <span className="av-wrap">
                <Avatar name={f.name || t("friend")} photo={f.photo} />
                {isOnline(f) && <span className="on-dot" aria-hidden="true" />}
              </span>
              <div className="meta">
                <div className="name" style={isUnread(f) ? { fontWeight: 600 } : undefined}>{f.name || t("friend")}</div>
                <div className="sub">{preview(f)}</div>
              </div>
              <div className="item-end">
                <span className={"item-time" + (isUnread(f) ? " unread" : "")}>{when(f.lastAt)}</span>
                {isUnread(f) && <span className="badge" aria-label={t("unread")}>{f.unread > 99 ? "99+" : f.unread}</span>}
              </div>
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

        </>) : (
        <div className="list settings-tab">
          <section className="set-card">
            <h3 className="set-title">{t("setFriends")}</h3>
            <div className="set-row col">
              <span className="set-label">{t("setAdd")}</span>
              <form className="add-form" onSubmit={sendRequest}>
                <input className="field" type="email" placeholder={t("gmail")} value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="btn-sm" type="submit">{t("add")}</button>
              </form>
              {info && <p className="info" role="status">{info}</p>}
            </div>
          </section>
          <section className="set-card">
            <h3 className="set-title">{t("setLook")}</h3>
            <div className="set-row"><span className="set-label">{t("setLang")}</span><LangSwitch /></div>
            <div className="set-row"><span className="set-label">{t("setColor")}</span><ThemeSwitch /></div>
            <div className="set-row"><span className="set-label">{t("setMode")}</span><ModeSwitch /></div>
          </section>
          <section className="set-card">
            <h3 className="set-title">{t("setVoice")}</h3>
            <div className="set-row"><span className="set-label">{t("setTurn")}</span><FastSwitch /></div>
            <p className="set-hint">{t("turnHint")}</p>
            <div className="set-row"><span className="set-label">{t("setTest")}</span><button className="btn-sm ghost" onClick={() => setDiagOpen(true)}>{t("diagTest")}</button></div>
          </section>
          {notif !== "unsupported" && (
            <section className="set-card">
              <h3 className="set-title">{t("setNotif")}</h3>
              <div className="set-row">
                <span className="set-label">{t("setNotif")}</span>
                {notif === "default" && <button className="btn-sm" onClick={turnOnNotif}>{t("notifOn")}</button>}
                {notif === "granted" && <span className="set-val">✓</span>}
                {notif === "denied" && <span className="set-val muted">{t("notifBlocked")}</span>}
              </div>
            </section>
          )}
        </div>
        )}
      </aside>

      {diagOpen && <Diag uid={user.uid} onClose={() => setDiagOpen(false)} />}

      {blocked && (
        <button
          className="live-banner tap"
          onClick={() => { getAudioCtx(); setBlocked(false); liveAudio.current?.play().catch(() => {}); }}
        >
          <Icon name="mic" size={18} /> {t("tapSound")}
        </button>
      )}
      {speaker && !blocked && (
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
            <div><p className="credit-pill soft" style={{ marginTop: 0, marginBottom: 16 }}><Logo size={20} /> <Credit /></p><p>{t("pickChat")}</p></div>
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
  const [ready, setReady] = useState(false);
  const [lim, setLim] = useState(60);
  const olderRef = useRef(false);
  const [text, setText] = useState("");
  const [rec, setRec] = useState(false);
  const [sec, setSec] = useState(0);
  const [err, setErr] = useState("");
  const [liveState, setLiveState] = useState("");
  const [diag, setDiag] = useState("");
  const [presence, setPresence] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [peerRead, setPeerRead] = useState(0);
  const marked = useRef("");
  const scrolled = useRef(false);
  const endRef = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const startedAt = useRef(0);
  const limitTimer = useRef(null);
  const first = useRef(true);
  const pressed = useRef(false);
  const lockedRef = useRef(false);
  const wakeRef = useRef(null);
  const [delId, setDelId] = useState(null);
  const pressTimer = useRef(null);
  const longFired = useRef(false);
  const [locked, setLocked] = useState(false);
  const liveRef = useRef(null);
  const [drag, setDrag] = useState(0);
  const [arming, setArming] = useState(false);
  const [lvl, setLvl] = useState(0);
  const micRef = useRef(null);
  const micTimer = useRef(null);
  const gumBusy = useRef(false);
  // Mikrofonu her basışta yeniden isteme (iPhone takılıyor): bir kez al, 40 sn kullanılmazsa bırak
  async function getMic() {
    clearTimeout(micTimer.current);
    const cur = micRef.current;
    if (cur && cur.getAudioTracks().some((tr) => tr.readyState === "live")) return cur;
    let late = false;
    const st = await Promise.race([
      navigator.mediaDevices.getUserMedia({ audio: true }).then((x) => {
        if (late) { x.getTracks().forEach((tr) => tr.stop()); return null; }
        return x;
      }),
      new Promise((_, rej) => setTimeout(() => { late = true; rej(Object.assign(new Error("timeout"), { name: "Timeout" })); }, 6000)),
    ]);
    micRef.current = st;
    return st;
  }
  const dropMicLater = () => {
    clearTimeout(micTimer.current);
    micTimer.current = setTimeout(() => {
      micRef.current?.getTracks().forEach((tr) => tr.stop());
      micRef.current = null;
    }, 40000);
  };
  const relayRef = useRef(null);
  const relayWatch = useRef(null);
  const statusRef = useRef("offline");
  const lastPing = useRef(0);

  // Arkadaşın çevrimiçi / odada durumu
  useEffect(() => {
    const un = onSnapshot(doc(db, "users", friend.uid), (d) => setPresence(d.data() || null));
    const iv = setInterval(() => setNow(Date.now()), 15000);
    return () => { un(); clearInterval(iv); };
  }, [friend.uid]);

  const seen = presence?.lastSeen?.toMillis?.() || 0;
  const status = !seen || now - seen > 70000 ? "offline" : presence?.room === chatId ? "room" : "online";
  statusRef.current = status;
  // Ses ayrı belgede saklanır; eski mesajlarda mesajın içindedir
  const loadAudio = async (id, m) => {
    if (m.audio) return m.audio;
    try {
      const d = await getDoc(doc(db, "chats", chatId, "audio", id));
      return d.data()?.data || "";
    } catch { return ""; }
  };

  const lastSeenText = () => {
    if (!seen) return "";
    const d = new Date(seen), n = new Date(), y = new Date(n.getTime() - 86400000);
    const hm = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const day = d.toDateString() === n.toDateString() ? t("stToday") : d.toDateString() === y.toDateString() ? t("stYesterday") : d.toLocaleDateString(locale, { day: "numeric", month: "short" });
    return t("stLastSeen", { t: day + " " + hm });
  };
  const statusLabel = status === "offline"
    ? (seen ? lastSeenText() : t("stOffline"))
    : { room: t("stInRoom"), online: t("stOnline") }[status];

  useEffect(() => {
    first.current = true;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), limit(lim));
    return onSnapshot(q, (snap) => {
      setMsgs(snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());
      setReady(true);
      // Canlı yayınla zaten dinlenmeyen sesli mesajı otomatik çal
      if (!first.current) {
        snap.docChanges().forEach((c) => {
          const m = c.doc.data();
          if (c.type === "added" && m.from !== me.uid && m.type === "voice" && !m.live) {
            loadAudio(c.doc.id, m).then((u) => u && new Audio(u).play().catch(() => {}));
          }
        });
      }
      first.current = false;
    });
  }, [chatId, me.uid, lim]);

  // Karşı tarafın okuma zamanı (okundu işareti için)
  useEffect(
    () => onSnapshot(doc(db, "chats", chatId), (d) => setPeerRead(d.data()?.["read_" + friend.uid]?.toMillis?.() || 0)),
    [chatId, friend.uid]
  );

  // Açık sohbette gelen mesajları okundu say: sayaç sıfırlanır, karşı taraf okundu işaretini görür
  useEffect(() => {
    if (olderRef.current) olderRef.current = false;
    else endRef.current?.scrollIntoView({ behavior: scrolled.current ? "smooth" : "auto", block: "end" });
    if (msgs.length) scrolled.current = true;
    onRead?.();
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      const last = [...msgs].reverse().find((m) => m.from !== me.uid);
      if (!last || marked.current === last.id) return;
      marked.current = last.id;
      updateDoc(doc(db, "chats", chatId), {
        ["read_" + me.uid]: serverTimestamp(), ["unread_" + me.uid]: 0,
      }).catch(() => {});
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [msgs]);

  // Kilitli yayın: ekran uyumasın, arka plandan dönünce kilidi yenile, bildirimden durdurulabilsin
  useEffect(() => {
    if (!locked) return;
    const getLock = async () => {
      try {
        if (document.visibilityState === "visible" && navigator.wakeLock && !wakeRef.current) {
          wakeRef.current = await navigator.wakeLock.request("screen");
          wakeRef.current.addEventListener?.("release", () => { wakeRef.current = null; });
        }
      } catch {}
    };
    getLock();
    document.addEventListener("visibilitychange", getLock);
    const ms = "mediaSession" in navigator ? navigator.mediaSession : null;
    try {
      if (ms) {
        ms.metadata = new MediaMetadata({ title: "Telsiz", artist: t("lockOnAir", { name: friend.name || t("friend") }) });
        ms.setActionHandler("pause", () => stopRec());
        ms.setActionHandler("stop", () => stopRec());
      }
    } catch {}
    return () => {
      document.removeEventListener("visibilitychange", getLock);
      try { wakeRef.current?.release(); } catch {}
      wakeRef.current = null;
      try {
        if (ms) {
          ms.setActionHandler("pause", null);
          ms.setActionHandler("stop", null);
          ms.metadata = new MediaMetadata({ title: "Telsiz", artist: "Canlı telsiz açık" });
        }
      } catch {}
    };
  }, [locked]);

  useEffect(() => {
    document.body.classList.toggle("talking", rec);
    return () => document.body.classList.remove("talking");
  }, [rec]);

  useEffect(() => {
    if (!rec) return;
    setSec(0);
    const i = setInterval(() => setSec(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(i);
  }, [rec]);

  async function afterSend(kind, quiet) {
    await updateDoc(doc(db, "chats", chatId), {
      lastAt: serverTimestamp(), lastFrom: me.uid, lastKind: kind, ["unread_" + friend.uid]: increment(1),
    });
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

  async function startRec(e, lock = false) {
    e.preventDefault();
    getAudioCtx(); // ses motorunu dokunuş anında aç (iPhone şartı)
    if (lockedRef.current) return stopRec(); // kilitliyken dokununca bitir
    if (recorder.current?.state === "recording") return;
    setErr("");
    pressed.current = true;
    lockedRef.current = lock;
    setLocked(lock);
    if (!lock) {
      // Bırakma olayı nerede olursa olsun yakala (parmak düğmenin dışına kaysa bile)
      const x0 = e.clientX;
      const move = (ev) => {
        if (lockedRef.current) return;
        const p = Math.max(0, Math.min(1, (ev.clientX - x0) / 90));
        setDrag(p);
        if (p >= 1) { // sağa kaydırıldı: kilitle
          lockedRef.current = true;
          setLocked(true);
          setDrag(0);
          try { navigator.vibrate?.(30); } catch {}
          if (recorder.current?.state === "recording") {
            clearTimeout(limitTimer.current);
            limitTimer.current = setTimeout(stopRec, 220000);
          }
        }
      };
      window.addEventListener("pointermove", move);
      const release = () => {
        ["pointerup", "pointercancel", "mouseup", "touchend", "touchcancel"].forEach((ev) =>
          window.removeEventListener(ev, release)
        );
        window.removeEventListener("pointermove", move);
        setDrag(0);
        if (!lockedRef.current) stopRec();
      };
      ["pointerup", "pointercancel", "mouseup", "touchend", "touchcancel"].forEach((ev) =>
        window.addEventListener(ev, release)
      );
    }
    setLiveState("");
    if (gumBusy.current) return; // mikrofon isteği sürerken yeni istek açma
    gumBusy.current = true;
    setArming(true); // dokunuş anında görsel tepki: mikrofon hazırlanırken de tuş canlı görünsün
    try {
      const stream = await getMic();
      gumBusy.current = false;
      setArming(false);
      if (!pressed.current) { // izin penceresi sırasında bırakıldı
        dropMicLater();
        return;
      }
      let fb = null, fellBack = false;
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      chunks.current = [];
      mr.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      mr.onstop = async () => {
        clearTimeout(fb);
        dropMicLater();
        const lv = liveRef.current;
        liveRef.current = null;
        const rl = relayRef.current;
        relayRef.current = null;
        clearInterval(relayWatch.current);
        rl?.stop();
        const heardLive = !!lv?.heard;
        lv?.stop();
        if (Date.now() - startedAt.current >= 500) {
          // Son paketlerin ulaşması için kısa bekle, sonra sonucu göster
          setTimeout(() => {
            const ok = heardLive || (rl?.delivered || 0) > 0;
            const why = ok ? "diagLive" : statusRef.current === "offline" ? "diagOffline" : "diagNoAnswer";
            setDiag(why);
            setTimeout(() => setDiag(""), 6000);
          }, 1500);
        }
        setLiveState("");
        if (Date.now() - startedAt.current < 500) return; // yanlışlıkla dokunma
        // Sesli mesaj gönderimi kapalı: telsiz yalnızca canlı iletilir, kayıt saklanmaz
      };
      recorder.current = mr;
      startedAt.current = Date.now();
      mr.start();
      setRec(true);
      limitTimer.current = setTimeout(stopRec, lockedRef.current ? 220000 : 60000);
      // Arkadaş çevrimdışıysa (uygulama kapalı) ona bildirim gönder; 30 sn içinde tekrar gönderme
      if (statusRef.current === "offline" && Date.now() - (lastPing.current || 0) > 30000) {
        lastPing.current = Date.now();
        notifyUser(friend.uid, me.displayName || "Telsiz", t("wantsTalk"));
      }
      const startFallback = () => {
        relayRef.current = startRelay({ chatId, from: me.uid, stream });
        clearInterval(relayWatch.current);
        relayWatch.current = setInterval(() => {
          const r = relayRef.current;
          if (r) setLvl(r.level);
          if (r && r.delivered > 0) setLiveState("live");
        }, 300);
      };
      const fast = liveSupported() && localStorage.getItem("fast") === "1";
      if (fast) {
        // TURN açık: ses doğrudan bağlantıyla gider. 4 sn içinde kurulamazsa yedek yola geçer (çift ses olmasın diye doğrudan kapatılır).
        const goFallback = () => {
          if (fellBack || recorder.current !== mr || mr.state !== "recording") return;
          fellBack = true;
          liveRef.current?.stop();
          liveRef.current = null;
          startFallback();
        };
        startLive({ from: me.uid, to: friend.uid, stream, onState: (st) => (st === "failed" ? goFallback() : setLiveState(st)) })
          .then((lv) => {
            if (fellBack || recorder.current !== mr || mr.state !== "recording") lv.stop();
            else liveRef.current = lv;
          })
          .catch(goFallback);
        fb = setTimeout(() => { if (!liveRef.current?.connected) goFallback(); }, 4000);
      } else {
        startFallback();
      }
    } catch (er) {
      gumBusy.current = false;
      setArming(false);
      stopRec();
      setErr(er?.name === "Timeout" ? t("micStuck") : t("micNeeded") + (er?.name ? " (" + er.name + ")" : ""));
    }
  }

  function stopRec() {
    pressed.current = false;
    lockedRef.current = false;
    setLocked(false);
    clearTimeout(limitTimer.current);
    if (recorder.current && recorder.current.state === "recording") recorder.current.stop();
    setRec(false);
  }

  const pressStart = (id) => {
    longFired.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => { longFired.current = true; setDelId(id); }, 550);
  };
  const pressEnd = () => clearTimeout(pressTimer.current);
  async function removeMsg() {
    const id = delId;
    setDelId(null);
    try {
      await deleteDoc(doc(db, "chats", chatId, "messages", id));
      deleteDoc(doc(db, "chats", chatId, "audio", id)).catch(() => {});
    }
    catch (er) { setErr(t("delFail", { e: er.code || er.message })); }
  }

  const clock = (m) => m.createdAt?.toDate?.().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const recLabel = status === "offline" && liveState !== "live" ? t("offlineRec") : liveState === "live" ? t("live") : liveState === "connecting" ? t("connecting") : t("releaseSend");

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
        {ready && msgs.length >= lim && (
          <button type="button" className="older-btn" onClick={() => { olderRef.current = true; setLim((n) => n + 60); }}>{t("older")}</button>
        )}
        {!ready && (
          <div className="sk-msgs" aria-hidden="true">
            <i className="sk sk-b l" style={{ width: "52%" }} /><i className="sk sk-b r" style={{ width: "38%" }} /><i className="sk sk-b l" style={{ width: "64%" }} /><i className="sk sk-b r" style={{ width: "46%" }} />
          </div>
        )}
        {ready && msgs.length === 0 && (
          <div className="chat-empty">
            <Icon name="mic" size={28} />
            <p>{t("emptyChat")}</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={m.id}
            className={"msg" + (m.from === me.uid ? " me" : "") + (i === 0 || msgs[i - 1].from !== m.from ? " first" : "") + (i === msgs.length - 1 || msgs[i + 1].from !== m.from ? " last" : "")}
            onPointerDown={() => pressStart(m.id)}
            onPointerUp={pressEnd}
            onPointerLeave={pressEnd}
            onPointerCancel={pressEnd}
            onContextMenu={(e) => e.preventDefault()}
            onClickCapture={(e) => { if (longFired.current) { e.preventDefault(); e.stopPropagation(); longFired.current = false; } }}
          >
            {m.type === "voice" ? <VoiceMsg src={m.audio} id={m.id} dur={m.dur} load={() => loadAudio(m.id, m)} /> : m.text}
            <span className="time">
              {clock(m)}
              {m.from === me.uid && (() => {
                const read = m.createdAt?.toMillis && peerRead >= m.createdAt.toMillis();
                return <span className={"tick" + (read ? " read" : "")} aria-hidden="true"> {read ? "✓✓" : "✓"}</span>;
              })()}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {delId && (
        <div className="sheet-bg" onClick={() => setDelId(null)}>
          <div className="sheet" role="dialog" aria-label={t("delMsg")} onClick={(e) => e.stopPropagation()}>
            <button className="sheet-del" onClick={removeMsg}>{t("delMsg")}</button>
            <button className="sheet-cancel" onClick={() => setDelId(null)}>{t("cancel")}</button>
          </div>
        </div>
      )}

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
              <span className="meter" aria-hidden="true">
                {[0.12, 0.3, 0.5, 0.7].map((th, i) => <i key={i} className={lvl > th * 0.6 ? "on" : ""} style={{ height: 6 + i * 4 }} />)}
              </span>
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
        </form>
        <div className="ptt-wrap">
          <div className="ptt-row">
            <span className="ptt-side" aria-hidden="true" />
            <button
              type="button"
              className={"ptt" + (rec ? " rec" : "") + (arming && !rec ? " arming" : "")}
              style={drag ? { transform: `translateX(${drag * 38}px)` } : undefined}
              onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} startRec(e, false); }}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={locked ? t("stopLock") : t("holdToTalk")}
              title={locked ? t("stopLock") : t("holdToTalk")}
            >
              <Icon name={locked ? "stop" : "mic"} size={38} />
            </button>
            <span className="ptt-side" aria-hidden="true">
              <span className={"lock-hint" + (rec && !locked ? " show" : "") + (locked ? " done" : "")} style={{ opacity: locked ? 1 : 0.35 + drag * 0.65, transform: `scale(${1 + drag * 0.35})` }}>
                <Icon name="lock" size={22} />
              </span>
            </span>
          </div>
          {!rec && <p className="ptt-cap">{arming ? t("arming") : t("holdToTalk")}</p>}
          {rec && !locked && <p className="ptt-cap">{t("slideLock")}</p>}
          {rec && locked && <p className="hint">{t("lockedHint")}</p>}
          {!rec && diag && <p className={"hint diag " + (diag === "diagLive" ? "ok" : "warn")}>{t(diag)}</p>}
        </div>
      </div>
    </>
  );
}
