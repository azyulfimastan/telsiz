"use client";
import { useEffect, useState } from "react";
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import Main from "./Main";
import { Icon, LangSwitch, Logo } from "./ui";
import { useI18n } from "@/lib/i18n";

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function Page() {
  const [user, setUser] = useState(undefined);
  const [err, setErr] = useState("");
  const { t } = useI18n();

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
          setErr(t("firestoreErr", { code: e.code }));
        }
      }
      setUser(u);
    });
  }, []);

  if (user === undefined) return <div className="loading">{t("loading")}</div>;

  if (!user)
    return (
      <main className="login">
        <div className="login-box">
          <Logo size={44} />
          <div>
            <h1>Telsiz</h1>
            <p>{t("tagline")}</p>
          </div>
          <button className="btn-google" onClick={login}>
            <GoogleG /> {t("googleLogin")}
          </button>
          {err && (
            <p className="err" role="alert">
              <Icon name="alert" size={16} /> <span>{err}</span>
            </p>
          )}
          <LangSwitch />
        </div>
      </main>
    );

  return (
    <>
      {err && (
        <p className="banner" role="alert">
          <Icon name="alert" size={16} /> {err}
        </p>
      )}
      <Main user={user} onLogout={() => signOut(auth)} />
    </>
  );
}
