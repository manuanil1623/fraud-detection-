// lib/mockData.js
// Generates realistic-looking mock transaction data so the dashboard
// and API have something to analyze out of the box. Swap this out for
// your real data source (DB, warehouse, payment processor webhook, etc).

const CATEGORIES = [
  "groceries",
  "electronics",
  "travel",
  "dining",
  "subscription",
  "gift_card",
  "crypto",
  "wire_transfer",
  "prepaid_card",
  "clothing",
];

const COUNTRIES = ["US", "GB", "DE", "NG", "IN", "BR", "RU", "CN", "FR", "CA"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function makeUserProfile(userId) {
  const homeCountry = pick(COUNTRIES);
  const baseSpend = randomBetween(20, 150);
  const knownDevices = [`device_${userId}_a`];
  // Occasionally a second known device
  if (Math.random() > 0.6) knownDevices.push(`device_${userId}_b`);

  return {
    userId,
    homeCountry,
    baseSpend,
    knownDevices,
    isNewAccount: Math.random() < 0.12,
    history: [], // running amount history, used for z-score baseline
  };
}

/**
 * Generates `count` mock transactions across `userCount` synthetic users,
 * spread over the last `days` days. A small fraction are deliberately
 * engineered to look fraudulent so the dashboard has something to flag.
 */
function generateMockTransactions({ count = 500, userCount = 40, days = 14 } = {}) {
  const users = Array.from({ length: userCount }, (_, i) => makeUserProfile(`user_${i + 1}`));
  const transactions = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const user = pick(users);
    const isFraudInjected = Math.random() < 0.08; // ~8% engineered anomalies

    const msAgo = randomBetween(0, days * 24 * 60 * 60 * 1000);
    const timestamp = new Date(now - msAgo).toISOString();

    let amount = Math.max(1, user.baseSpend + randomBetween(-15, 15));
    let country = user.homeCountry;
    let device = pick(user.knownDevices);
    let category = pick(CATEGORIES.filter((c) => !["gift_card", "crypto", "wire_transfer"].includes(c)));

    if (isFraudInjected) {
      amount = user.baseSpend * randomBetween(6, 20); // big spike
      country = pick(COUNTRIES.filter((c) => c !== user.homeCountry)); // geo mismatch
      device = `device_${user.userId}_unknown_${i}`; // new device
      category = pick(["gift_card", "crypto", "wire_transfer", "prepaid_card"]);
    }

    const txCountLastHour = isFraudInjected
      ? Math.floor(randomBetween(3, 10))
      : Math.floor(randomBetween(0, 2));

    transactions.push({
      id: `tx_${i + 1}`,
      userId: user.userId,
      amount: Number(amount.toFixed(2)),
      currency: "USD",
      country,
      homeCountry: user.homeCountry,
      device,
      knownDevices: user.knownDevices,
      timestamp,
      category,
      userHistoryAmounts: user.history.slice(),
      userTxCountLastHour: txCountLastHour,
      isNewAccount: user.isNewAccount,
    });

    // Update running history so later transactions from the same user
    // have a real baseline to be compared against.
    user.history.push(amount);
    if (user.history.length > 30) user.history.shift();
  }

  // Sort chronologically (oldest first) — easier to read in a timeline.
  transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return transactions;
}

module.exports = { generateMockTransactions, CATEGORIES, COUNTRIES };
