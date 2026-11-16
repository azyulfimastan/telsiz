"use client";
export default function GlobalError({ error, reset }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h2>Telsiz</h2>
        <p>Bir hata oluştu / Wystąpił błąd / Something went wrong</p>
        <pre style={{ whiteSpace: "pre-wrap", color: "#b00020" }}>{String(error?.message || error)}</pre>
        <button style={{ padding: 12 }} onClick={() => reset()}>Tekrar dene / Retry</button>
      </body>
    </html>
  );
}
