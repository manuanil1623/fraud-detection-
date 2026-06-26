// app/api/transactions/score/route.js
// POST /api/transactions/score
// Body: a single transaction object (see lib/fraudEngine.js for shape)
// Returns: { score, level, reasons, signals }
//
// Runs as a Vercel serverless function (Node runtime). Stateless and
// fast — safe to call synchronously from a checkout/login flow.

import { NextResponse } from "next/server";
import { scoreTransaction } from "../../../../lib/fraudEngine";

export async function POST(request) {
  let tx;
  try {
    tx = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof tx.amount !== "number" || !tx.userId) {
    return NextResponse.json(
      { error: "Transaction must include at least `userId` and a numeric `amount`" },
      { status: 400 }
    );
  }

  const result = scoreTransaction(tx);
  return NextResponse.json({ transactionId: tx.id || null, ...result });
}

export async function GET() {
  return NextResponse.json({
    usage: "POST a transaction JSON body to this endpoint to get a fraud risk score.",
    example: {
      id: "tx_123",
      userId: "user_42",
      amount: 980,
      currency: "USD",
      country: "RU",
      homeCountry: "US",
      device: "device_unknown_1",
      knownDevices: ["device_42_a"],
      timestamp: new Date().toISOString(),
      category: "gift_card",
      userHistoryAmounts: [42, 38, 51, 45, 60],
      userTxCountLastHour: 4,
      isNewAccount: false,
    },
  });
}
