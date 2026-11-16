"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import Main from "./Main";

export default function Page() {
  const [user, setUser] = useState(undefined);
  const [err, setErr] = useState("");

  async function login() {
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
  }

  useEffect(() => {
    getRedirectResult(auth).catch((e) => setErr(e.code + ": " + e.message));
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await setDoc(
            doc(db, "users", u.uid),
            {
              name: u.displayName || u.email,
              email: (u.email || "").toLowerCase(),
              photo: u.photoURL || "",
              lastSeen: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (e) {
          setErr("Firestore: " + e.code + " — Firebase'de Firestore Rules yayınlanmış mı?");
        }
      }
      setUser(u);
    });
  }, []);

  if (user === undefined) return <div className="center muted">Yükleniyor…</div>;

  if (!user)
    return (
      <div className="center">
        <h1>📻 Telsiz</h1>
        <p className="muted">Arkadaşlarınla yaz, bas-konuş ile sesli mesaj gönder.</p>
        <button className="primary" onClick={login}>
          Google ile giriş yap
        </button>
        {err && <p className="muted" style={{ maxWidth: 360, wordBreak: "break-word" }}>⚠️ {err}</p>}
      </div>
    );

  return (
    <>
      {err && <p style={{ background: "#7f1d1d", padding: 8, textAlign: "center" }}>⚠️ {err}</p>}
      <Main user={user} onLogout={() => signOut(auth)} />
    </>
  );
}
