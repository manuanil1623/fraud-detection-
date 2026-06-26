// app/dashboard/page.jsx
"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const LEVEL_COLOR = {
  low: "#34D399",
  medium: "#FFD23F",
  high: "#FF9F43",
  critical: "#FF5C5C",
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function RiskPill({ level, score }) {
  return (
    <span className="risk-pill" style={{ "--pill-color": LEVEL_COLOR[level] }}>
      <span className="risk-dot" />
      {level} · {score}
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);

  async function load() {
    try {
      setError(null);
      const res = await fetch("/api/analytics/summary", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setData(json);
      setLoadedAt(new Date());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = data?.summary;
  const flagged = data?.flagged || [];

  const categoryData = summary
    ? Object.entries(summary.byCategory).map(([category, v]) => ({
        category,
        count: v.count,
        flagged: v.flagged,
      }))
    : [];

  const fmtMoney = (n) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="page">
      <style>{`
        :root {
          --bg: #0A0E14;
          --surface: #11161F;
          --surface-2: #161D29;
          --hairline: #232B38;
          --text: #E9EDF3;
          --text-dim: #8893A6;
          --accent: #5B8DEF;
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .page {
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 32px 40px 64px;
        }
        .topbar {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 28px;
          border-bottom: 1px solid var(--hairline);
          padding-bottom: 20px;
        }
        .topbar h1 {
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.01em;
          margin: 0;
        }
        .topbar .eyebrow {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-dim);
          margin-bottom: 4px;
        }
        .status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-dim);
          font-family: 'IBM Plex Mono', monospace;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #34D399;
          box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.6);
          animation: pulse 1.8s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.55); }
          70% { box-shadow: 0 0 0 7px rgba(52, 211, 153, 0); }
          100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
        }
        .refresh-btn {
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          color: var(--text);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          font-family: 'IBM Plex Mono', monospace;
        }
        .refresh-btn:hover { border-color: var(--accent); }
        .refresh-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 10px;
          padding: 18px 20px;
        }
        .stat-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-dim);
          margin-bottom: 10px;
        }
        .stat-value {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 28px;
          font-weight: 600;
        }
        .stat-sub {
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-dim);
        }

        .chart-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 16px;
          margin-bottom: 28px;
        }
        .panel {
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 10px;
          padding: 20px;
        }
        .panel h2 {
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 14px;
          color: var(--text);
        }

        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th {
          text-align: left;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-dim);
          padding: 8px 10px;
          border-bottom: 1px solid var(--hairline);
        }
        td {
          padding: 9px 10px;
          border-bottom: 1px solid var(--hairline);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12.5px;
        }
        tr:hover td { background: var(--surface-2); }

        .risk-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-family: 'IBM Plex Mono', monospace;
          text-transform: capitalize;
          background: color-mix(in srgb, var(--pill-color) 16%, transparent);
          color: var(--pill-color);
          border: 1px solid color-mix(in srgb, var(--pill-color) 45%, transparent);
        }
        .risk-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pill-color); }

        .reasons { color: var(--text-dim); font-size: 11.5px; font-family: 'Inter', sans-serif; }
        .error-banner {
          background: #2A1418;
          border: 1px solid #5C2730;
          color: #FF9F9F;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 13px;
        }
        .empty {
          color: var(--text-dim);
          font-size: 13px;
          padding: 24px;
          text-align: center;
        }
        @media (max-width: 900px) {
          .stat-grid { grid-template-columns: repeat(2, 1fr); }
          .chart-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="topbar">
        <div>
          <div className="eyebrow">Fraud Detection · Analytics</div>
          <h1>Transaction Risk Monitor</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/upload" style={{ color: "#8893A6", fontSize: 13, textDecoration: "none" }}>
            Upload your own data →
          </a>
          <div className="status">
            <span className="pulse-dot" />
            {loadedAt ? `Last scored ${loadedAt.toLocaleTimeString()}` : "Scoring…"}
          </div>
          <button className="refresh-btn" onClick={load}>
            Re-run scoring
          </button>
        </div>
      </div>

      {error && <div className="error-banner">Couldn't load analytics: {error}</div>}

      {!summary && !error && <div className="empty">Scoring transactions…</div>}

      {summary && (
        <>
          <div className="stat-grid">
            <StatCard label="Transactions Scored" value={summary.total.toLocaleString()} />
            <StatCard
              label="Flagged (High + Critical)"
              value={summary.flaggedCount.toLocaleString()}
              sub={`${(summary.flaggedRate * 100).toFixed(1)}% of volume`}
              accent="#FF5C5C"
            />
            <StatCard label="Total Volume" value={fmtMoney(summary.totalAmount)} />
            <StatCard
              label="Flagged Volume"
              value={fmtMoney(summary.flaggedAmount)}
              sub={
                summary.totalAmount
                  ? `${((summary.flaggedAmount / summary.totalAmount) * 100).toFixed(1)}% of total $`
                  : undefined
              }
              accent="#FF9F43"
            />
          </div>

          <div className="chart-grid">
            <div className="panel">
              <h2>Average Risk Score &amp; Volume Over Time</h2>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={summary.timeline}>
                  <defs>
                    <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#232B38" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#8893A6", fontSize: 11 }} axisLine={{ stroke: "#232B38" }} tickLine={false} />
                  <YAxis tick={{ fill: "#8893A6", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ background: "#161D29", border: "1px solid #232B38", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#E9EDF3" }}
                  />
                  <Area type="monotone" dataKey="avgScore" name="Avg risk score" stroke="#5B8DEF" fill="url(#scoreFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="panel">
              <h2>Flagged Rate by Category</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke="#232B38" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#8893A6", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="category"
                    type="category"
                    tick={{ fill: "#8893A6", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{ background: "#161D29", border: "1px solid #232B38", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#E9EDF3" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#8893A6" }} />
                  <Bar dataKey="count" name="Total" fill="#2A3342" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="flagged" name="Flagged" fill="#FF5C5C" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <h2>Top Flagged Transactions</h2>
            {flagged.length === 0 ? (
              <div className="empty">No high-risk transactions in this batch.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Tx ID</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>Country</th>
                    <th>Risk</th>
                    <th>Top reason</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.id}</td>
                      <td>{tx.userId}</td>
                      <td>{fmtMoney(tx.amount)}</td>
                      <td>{tx.category}</td>
                      <td>
                        {tx.country}
                        {tx.country !== tx.homeCountry ? ` (home: ${tx.homeCountry})` : ""}
                      </td>
                      <td>
                        <RiskPill level={tx.fraud.level} score={tx.fraud.score} />
                      </td>
                      <td className="reasons">{tx.fraud.reasons[0] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
