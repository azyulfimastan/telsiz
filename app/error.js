"use client";
export default function Error({ error, reset }) {
  return (
    <main className="login">
      <div className="login-box">
        <h1>Telsiz</h1>
        <p>Bir hata oluştu / Wystąpił błąd / Something went wrong</p>
        <p className="err" style={{ wordBreak: "break-word" }}>{String(error?.message || error)}</p>
        <button className="btn-google" onClick={() => reset()}>Tekrar dene / Spróbuj ponownie / Retry</button>
        <button className="btn-google" onClick={() => { try { localStorage.clear(); } catch {} location.reload(); }}>
          Sıfırla ve yenile / Reset
        </button>
      </div>
    </main>
  );
}
