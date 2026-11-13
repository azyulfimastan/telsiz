"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import Main from "./Main";

export default function Page() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
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
        <button className="primary" onClick={() => signInWithPopup(auth, googleProvider)}>
          Google ile giriş yap
        </button>
      </div>
    );

  return <Main user={user} onLogout={() => signOut(auth)} />;
}
