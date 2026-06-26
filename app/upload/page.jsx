// app/upload/page.jsx
"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const FIELD_LABELS = {
  id: "Transaction ID",
  userId: "User / Customer ID *",
  amount: "Amount *",
  currency: "Currency",
  timestamp: "Timestamp / Date *",
  country: "Transaction Country",
  homeCountry: "Home Country",
  device: "Device ID",
  category: "Category",
  isNewAccount: "Is New Account",
};

const REQUIRED = ["userId", "amount", "timestamp"];

const LEVEL_COLOR = { low: "#34D399", medium: "#FFD23F", high: "#FF9F43", critical: "#FF5C5C" };

// --- Lightweight header-mapping heuristics (mirrors lib/columnMapper.js,
// duplicated here so this is a plain client component with no server round-trip
// needed just to preview the guess). ---
const HINTS = {
  id: ["id", "transaction_id", "txid", "tx_id", "reference", "ref"],
  userId: ["userid", "user_id", "customer_id", "customerid", "account_id", "accountid", "user", "customer"],
  amount: ["amount", "value", "total", "price", "transaction_amount", "amt"],
  currency: ["currency", "curr"],
  timestamp: ["timestamp", "date", "datetime", "created_at", "transaction_date", "time"],
  country: ["country", "transaction_country", "country_code", "billing_country"],
  homeCountry: ["home_country", "homecountry", "registered_country", "account_country", "user_country"],
  device: ["device", "device_id", "deviceid", "device_fingerprint", "fingerprint"],
  category: ["category", "type", "merchant_category", "product_category", "transaction_type"],
  isNewAccount: ["is_new_account", "new_account", "newaccount"],
};

function norm(h) {
  return String(h || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function guessMapping(headers) {
  const normalized = headers.map((h) => ({ raw: h, norm: norm(h) }));
  const mapping = {};
  for (const [field, hints] of Object.entries(HINTS)) {
    let found = null;
    for (const hint of hints) {
      const exact = normalized.find((h) => h.norm === hint);
      if (exact) { found = exact.raw; break; }
    }
    if (!found) {
      for (const hint of hints) {
        const partial = normalized.find((h) => h.norm.includes(hint));
        if (partial) { found = partial.raw; break; }
      }
    }
    mapping[field] = found;
  }
  return mapping;
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
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

export default function UploadPage() {
  const [fileName, setFileName] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [stage, setStage] = useState("idle"); // idle -> mapping -> scoring -> done
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFile = useCallback((file) => {
    setError(null);
    setResult(null);
    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          if (!res.data.length) return setError("No rows found in that file.");
          setHeaders(Object.keys(res.data[0]));
          setRows(res.data);
          setMapping(guessMapping(Object.keys(res.data[0])));
          setStage("mapping");
        },
        error: (err) => setError(err.message),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          if (!data.length) return setError("No rows found in that sheet.");
          setHeaders(Object.keys(data[0]));
          setRows(data);
          setMapping(guessMapping(Object.keys(data[0])));
          setStage("mapping");
        } catch (err) {
          setError("Couldn't read that Excel file: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === "json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const arr = Array.isArray(data) ? data : data.transactions || data.rows;
          if (!Array.isArray(arr) || !arr.length) {
            return setError("JSON must be an array of objects (or { transactions: [...] }).");
          }
          setHeaders(Object.keys(arr[0]));
          setRows(arr);
          setMapping(guessMapping(Object.keys(arr[0])));
          setStage("mapping");
        } catch (err) {
          setError("Couldn't parse that JSON file: " + err.message);
        }
      };
      reader.readAsText(file);
    } else {
      setError(`Unsupported file type ".${ext}" — use CSV, XLSX, XLS, or JSON.`);
    }
  }, []);

  async function runScoring() {
    const missing = REQUIRED.filter((f) => !mapping[f]);
    if (missing.length) {
      setError(`Please map: ${missing.map((f) => FIELD_LABELS[f]).join(", ")}`);
      return;
    }
    setError(null);
    setStage("scoring");
    try {
      const res = await fetch("/api/transactions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mapping }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`);
      setResult(json);
      setStage("done");
    } catch (err) {
      setError(err.message);
      setStage("mapping");
    }
  }

  function reset() {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setStage("idle");
    setError(null);
    setResult(null);
  }

  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="page">
      <style>{`
        :root {
          --bg: #0A0E14; --surface: #11161F; --surface-2: #161D29;
          --hairline: #232B38; --text: #E9EDF3; --text-dim: #8893A6; --accent: #5B8DEF;
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .page { background: var(--bg); color: var(--text); min-height: 100vh;
          font-family: 'Inter', -apple-system, sans-serif; padding: 32px 40px 64px; }
        .topbar { display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 28px; border-bottom: 1px solid var(--hairline); padding-bottom: 20px; }
        .topbar h1 { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 600; margin: 0; }
        .eyebrow { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 4px; }
        .nav-link { color: var(--text-dim); text-decoration: none; font-size: 13px; }
        .nav-link:hover { color: var(--text); }
        .panel { background: var(--surface); border: 1px solid var(--hairline); border-radius: 10px; padding: 24px; margin-bottom: 20px; }
        .panel h2 { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; margin: 0 0 14px; }
        .dropzone { border: 1.5px dashed var(--hairline); border-radius: 10px; padding: 48px 24px;
          text-align: center; cursor: pointer; transition: border-color .15s; }
        .dropzone:hover, .dropzone.drag { border-color: var(--accent); }
        .dropzone input { display: none; }
        .drop-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
        .drop-sub { color: var(--text-dim); font-size: 12.5px; }
        .map-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
        .map-row { display: flex; flex-direction: column; gap: 4px; }
        .map-row label { font-size: 11.5px; color: var(--text-dim); }
        .map-row select { background: var(--surface-2); border: 1px solid var(--hairline); color: var(--text);
          padding: 8px 10px; border-radius: 6px; font-size: 13px; font-family: 'IBM Plex Mono', monospace; }
        .btn { background: var(--accent); color: #0A0E14; border: none; padding: 10px 18px; border-radius: 8px;
          font-weight: 600; font-size: 13px; cursor: pointer; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost { background: transparent; border: 1px solid var(--hairline); color: var(--text);
          padding: 10px 18px; border-radius: 8px; font-size: 13px; cursor: pointer; }
        .row-flex { display: flex; gap: 10px; align-items: center; }
        .preview-table { width: 100%; border-collapse: collapse; font-size: 11.5px; font-family: 'IBM Plex Mono', monospace; }
        .preview-table th, .preview-table td { padding: 6px 8px; border-bottom: 1px solid var(--hairline); text-align: left; white-space: nowrap; }
        .preview-table th { color: var(--text-dim); font-weight: 500; }
        .preview-wrap { overflow-x: auto; max-height: 180px; }
        .error-banner { background: #2A1418; border: 1px solid #5C2730; color: #FF9F9F; padding: 12px 16px;
          border-radius: 8px; margin-bottom: 20px; font-size: 13px; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
        .stat-card { background: var(--surface); border: 1px solid var(--hairline); border-radius: 10px; padding: 18px 20px; }
        .stat-label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 10px; }
        .stat-value { font-family: 'IBM Plex Mono', monospace; font-size: 26px; font-weight: 600; }
        .stat-sub { margin-top: 6px; font-size: 12px; color: var(--text-dim); }
        table.results { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.results th { text-align: left; font-size: 11px; letter-spacing: .06em; text-transform: uppercase;
          color: var(--text-dim); padding: 8px 10px; border-bottom: 1px solid var(--hairline); }
        table.results td { padding: 9px 10px; border-bottom: 1px solid var(--hairline); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
        table.results tr:hover td { background: var(--surface-2); }
        .risk-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px;
          font-size: 11px; font-family: 'IBM Plex Mono', monospace; text-transform: capitalize;
          background: color-mix(in srgb, var(--pill-color) 16%, transparent); color: var(--pill-color);
          border: 1px solid color-mix(in srgb, var(--pill-color) 45%, transparent); }
        .risk-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pill-color); }
        .reasons { color: var(--text-dim); font-size: 11.5px; font-family: 'Inter', sans-serif; }
        @media (max-width: 900px) { .stat-grid, .map-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="topbar">
        <div>
          <div className="eyebrow">Fraud Detection · Upload</div>
          <h1>Score Your Own Data</h1>
        </div>
        <a className="nav-link" href="/dashboard">← Back to dashboard</a>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {stage === "idle" && (
        <div className="panel">
          <h2>1. Choose a file</h2>
          <label
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="drop-title">Click to browse, or drag a file here</div>
            <div className="drop-sub">Supports CSV, Excel (.xlsx / .xls), or JSON — any column names, we'll map them next</div>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.json"
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>
      )}

      {(stage === "mapping" || stage === "scoring") && (
        <div className="panel">
          <h2>2. Confirm column mapping — {fileName} ({rows.length.toLocaleString()} rows)</h2>
          <div className="map-grid">
            {Object.entries(FIELD_LABELS).map(([field, label]) => (
              <div className="map-row" key={field}>
                <label>{label}</label>
                <select
                  value={mapping[field] || ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || null }))}
                >
                  <option value="">— not in file —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="preview-wrap" style={{ marginBottom: 16 }}>
            <table className="preview-table">
              <thead>
                <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>{headers.map((h) => <td key={h}>{String(r[h]).slice(0, 24)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-flex">
            <button className="btn" onClick={runScoring} disabled={stage === "scoring"}>
              {stage === "scoring" ? "Scoring…" : "Run fraud scoring"}
            </button>
            <button className="btn-ghost" onClick={reset}>Choose a different file</button>
          </div>
        </div>
      )}

      {stage === "done" && result && (
        <>
          <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>Scored <strong>{result.rowCount.toLocaleString()}</strong> rows from <strong>{fileName}</strong></div>
            <button className="btn-ghost" onClick={reset}>Upload another file</button>
          </div>

          <div className="stat-grid">
            <StatCard label="Rows Scored" value={result.summary.total.toLocaleString()} />
            <StatCard
              label="Flagged (High + Critical)"
              value={result.summary.flaggedCount.toLocaleString()}
              sub={`${(result.summary.flaggedRate * 100).toFixed(1)}% of rows`}
              accent="#FF5C5C"
            />
            <StatCard label="Total Amount" value={fmtMoney(result.summary.totalAmount)} />
            <StatCard
              label="Flagged Amount"
              value={fmtMoney(result.summary.flaggedAmount)}
              accent="#FF9F43"
            />
          </div>

          {result.summary.timeline.length > 1 && (
            <div className="panel">
              <h2>Average Risk Score Over Time</h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={result.summary.timeline}>
                  <defs>
                    <linearGradient id="upScoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#232B38" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#8893A6", fontSize: 11 }} axisLine={{ stroke: "#232B38" }} tickLine={false} />
                  <YAxis tick={{ fill: "#8893A6", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={{ background: "#161D29", border: "1px solid #232B38", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#E9EDF3" }} />
                  <Area type="monotone" dataKey="avgScore" name="Avg risk score" stroke="#5B8DEF" fill="url(#upScoreFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="panel">
            <h2>Flagged Transactions ({result.flagged.length})</h2>
            {result.flagged.length === 0 ? (
              <div style={{ color: "var(--text-dim)", padding: 16, textAlign: "center" }}>
                Nothing flagged as high/critical risk in this file.
              </div>
            ) : (
              <div className="preview-wrap" style={{ maxHeight: 420 }}>
                <table className="results">
                  <thead>
                    <tr>
                      <th>Row ID</th><th>User</th><th>Amount</th><th>Category</th><th>Country</th><th>Risk</th><th>Top reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.flagged.slice(0, 200).map((tx) => (
                      <tr key={tx.id}>
                        <td>{tx.id}</td>
                        <td>{tx.userId}</td>
                        <td>{fmtMoney(tx.amount)}</td>
                        <td>{tx.category}</td>
                        <td>{tx.country}{tx.country !== tx.homeCountry ? ` (home: ${tx.homeCountry})` : ""}</td>
                        <td><RiskPill level={tx.fraud.level} score={tx.fraud.score} /></td>
                        <td className="reasons">{tx.fraud.reasons[0] || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
