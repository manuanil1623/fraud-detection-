// app/api/transactions/upload/route.js
// POST /api/transactions/upload
// Body: { rows: Object[], mapping: { field: headerName, ... } }
//
// `rows` is already parsed into plain JS objects on the client (CSV via
// papaparse, Excel via xlsx/SheetJS, or JSON.parse for .json files) — this
// route just does the enrichment + scoring, which is shared logic with the
// rest of the app.

import { NextResponse } from "next/server";
import { enrichUpload } from "../../../../lib/enrichUpload";
import { scoreBatch } from "../../../../lib/fraudEngine";

const MAX_ROWS = 20000; // generous ceiling to keep serverless function memory/time sane

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { rows, mapping } = body || {};

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "`rows` must be a non-empty array" }, { status: 400 });
  }
  if (!mapping || typeof mapping !== "object") {
    return NextResponse.json({ error: "`mapping` is required (field -> column header)" }, { status: 400 });
  }
  if (!mapping.userId || !mapping.amount || !mapping.timestamp) {
    return NextResponse.json(
      { error: "Mapping must at least include userId, amount, and timestamp" },
      { status: 400 }
    );
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `File has ${rows.length} rows; this demo caps at ${MAX_ROWS}. Trim the file or batch it.` },
      { status: 413 }
    );
  }

  const transactions = enrichUpload(rows, mapping);
  const { results, summary } = scoreBatch(transactions);

  const flagged = results
    .filter((r) => r.fraud.level === "high" || r.fraud.level === "critical")
    .sort((a, b) => b.fraud.score - a.fraud.score);

  return NextResponse.json({
    summary,
    flagged,
    // Full per-row results too, capped, in case the UI wants to let users
    // browse beyond just the flagged ones.
    rowCount: results.length,
  });
}
