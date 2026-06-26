// app/api/analytics/summary/route.js
// GET /api/analytics/summary
// Returns aggregate fraud analytics: totals, breakdown by risk level,
// by category, by country, and a daily timeline — everything the
// dashboard needs to render its charts.
//
// This demo scores freshly generated mock data on every request so it's
// easy to try end-to-end. In production, swap `generateMockTransactions`
// for a real query (database, data warehouse, payment processor export)
// and consider caching the result (e.g. with `export const revalidate`).

import { NextResponse } from "next/server";
import { scoreBatch } from "../../../../lib/fraudEngine";
import { generateMockTransactions } from "../../../../lib/mockData";

export async function GET() {
  const transactions = generateMockTransactions({ count: 600, userCount: 50, days: 14 });
  const { results, summary } = scoreBatch(transactions);

  // Only ship the riskiest transactions in full detail to keep the
  // payload small; the dashboard table only needs the top offenders.
  const flagged = results
    .filter((r) => r.fraud.level === "high" || r.fraud.level === "critical")
    .sort((a, b) => b.fraud.score - a.fraud.score)
    .slice(0, 50);

  return NextResponse.json({ summary, flagged });
}
