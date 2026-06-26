// app/page.jsx
export default function Home() {
  return (
    <main
      style={{
        background: "#0A0E14",
        color: "#E9EDF3",
        minHeight: "100vh",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, margin: 0 }}>
        Fraud Detection Analytics
      </h1>
      <p style={{ color: "#8893A6", maxWidth: 480, margin: 0 }}>
        A rules-based + statistical fraud scoring engine, a JSON API, and an
        analytics dashboard — ready to deploy on Vercel.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <a
          href="/dashboard"
          style={{
            background: "#5B8DEF",
            color: "#0A0E14",
            padding: "10px 18px",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          Open Dashboard
        </a>
        <a
          href="/api/transactions/score"
          style={{
            border: "1px solid #232B38",
            color: "#E9EDF3",
            padding: "10px 18px",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          API Docs
        </a>
      </div>
    </main>
  );
}
