// scripts/test-engine.js
// Quick sanity check for the scoring engine — run with:
//   node scripts/test-engine.js
// No dependencies, no server needed.

const { scoreTransaction, scoreBatch } = require("../lib/fraudEngine");
const { generateMockTransactions } = require("../lib/mockData");

console.log("=== Single transaction: looks legit ===");
console.log(
  scoreTransaction({
    userId: "user_1",
    amount: 45,
    country: "US",
    homeCountry: "US",
    device: "device_1_a",
    knownDevices: ["device_1_a"],
    timestamp: new Date().toISOString(),
    category: "groceries",
    userHistoryAmounts: [40, 38, 50, 42, 47],
    userTxCountLastHour: 1,
    isNewAccount: false,
  })
);

console.log("\n=== Single transaction: looks fraudulent ===");
console.log(
  scoreTransaction({
    userId: "user_1",
    amount: 980,
    country: "RU",
    homeCountry: "US",
    device: "device_1_unknown",
    knownDevices: ["device_1_a"],
    timestamp: "2026-06-26T03:14:00.000Z",
    category: "gift_card",
    userHistoryAmounts: [40, 38, 50, 42, 47],
    userTxCountLastHour: 7,
    isNewAccount: true,
  })
);

console.log("\n=== Batch summary (500 mock transactions) ===");
const tx = generateMockTransactions({ count: 500, userCount: 40, days: 14 });
const { summary } = scoreBatch(tx);
console.log(JSON.stringify(summary.byLevel, null, 2));
console.log("Flagged rate:", (summary.flaggedRate * 100).toFixed(1) + "%");
console.log("Flagged volume: $" + summary.flaggedAmount.toFixed(2));
