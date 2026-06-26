// lib/fraudEngine.js
// Rules-based + statistical fraud scoring engine.
// Pure JS, no external services — safe to run in a Vercel serverless function.

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} userId
 * @property {number} amount
 * @property {string} currency
 * @property {string} country        // ISO country of the transaction
 * @property {string} homeCountry    // user's usual/registered country
 * @property {string} device         // device fingerprint id
 * @property {string[]} knownDevices // device fingerprints seen before for this user
 * @property {string} timestamp      // ISO string
 * @property {string} category       // e.g. "electronics", "travel", "gift_card"
 * @property {number[]} userHistoryAmounts // recent past amounts for this user
 * @property {number} userTxCountLastHour
 * @property {boolean} isNewAccount
 */

const RISK_WEIGHTS = {
  amountAnomaly: 28,
  velocity: 22,
  geoMismatch: 18,
  newDevice: 12,
  oddHour: 8,
  highRiskCategory: 7,
  newAccountHighValue: 15,
};

const HIGH_RISK_CATEGORIES = new Set([
  "gift_card",
  "crypto",
  "wire_transfer",
  "prepaid_card",
]);

/** Mean of an array, 0 for empty input. */
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Population standard deviation, 0 for arrays with < 2 points. */
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(variance);
}

/**
 * Z-score of `value` against a baseline distribution.
 * Returns 0 if there isn't enough history to judge.
 */
function zScore(value, history) {
  if (history.length < 3) return 0;
  const m = mean(history);
  const sd = stdDev(history);
  if (sd === 0) return value > m ? 4 : 0; // flat history but a jump in value
  return (value - m) / sd;
}

/** Hour-of-day risk: very late/early hours are weighted higher (heuristic, not a hard rule). */
function isOddHour(isoTimestamp) {
  const hour = new Date(isoTimestamp).getUTCHours();
  return hour >= 1 && hour <= 5;
}

/**
 * Score a single transaction.
 * @param {Transaction} tx
 * @returns {{score: number, level: "low"|"medium"|"high"|"critical", reasons: string[], signals: Object}}
 */
function scoreTransaction(tx) {
  const reasons = [];
  const signals = {};
  let score = 0;

  // 1. Amount anomaly vs this user's own spending history (z-score based)
  const z = zScore(tx.amount, tx.userHistoryAmounts || []);
  signals.amountZScore = Number(z.toFixed(2));
  if (z >= 3) {
    score += RISK_WEIGHTS.amountAnomaly;
    reasons.push(`Amount is ${z.toFixed(1)}σ above this user's typical spend`);
  } else if (z >= 2) {
    score += RISK_WEIGHTS.amountAnomaly * 0.5;
    reasons.push(`Amount is moderately above this user's typical spend (${z.toFixed(1)}σ)`);
  }

  // 2. Velocity — too many transactions in a short window
  const txCount = tx.userTxCountLastHour ?? 0;
  signals.txCountLastHour = txCount;
  if (txCount >= 6) {
    score += RISK_WEIGHTS.velocity;
    reasons.push(`${txCount} transactions from this user in the last hour`);
  } else if (txCount >= 3) {
    score += RISK_WEIGHTS.velocity * 0.5;
    reasons.push(`Elevated transaction velocity (${txCount} in the last hour)`);
  }

  // 3. Geo mismatch — transaction country differs from home country
  const geoMismatch = tx.country && tx.homeCountry && tx.country !== tx.homeCountry;
  signals.geoMismatch = Boolean(geoMismatch);
  if (geoMismatch) {
    score += RISK_WEIGHTS.geoMismatch;
    reasons.push(`Transaction country (${tx.country}) differs from home country (${tx.homeCountry})`);
  }

  // 4. New / unrecognized device
  const knownDevices = tx.knownDevices || [];
  const isNewDevice = tx.device && !knownDevices.includes(tx.device);
  signals.newDevice = Boolean(isNewDevice);
  if (isNewDevice) {
    score += RISK_WEIGHTS.newDevice;
    reasons.push("Transaction made from a previously unseen device");
  }

  // 5. Odd-hour transaction
  const oddHour = isOddHour(tx.timestamp);
  signals.oddHour = oddHour;
  if (oddHour) {
    score += RISK_WEIGHTS.oddHour;
    reasons.push("Transaction occurred during an unusual hour (1am–5am UTC)");
  }

  // 6. High-risk category
  const highRiskCategory = HIGH_RISK_CATEGORIES.has(tx.category);
  signals.highRiskCategory = highRiskCategory;
  if (highRiskCategory) {
    score += RISK_WEIGHTS.highRiskCategory;
    reasons.push(`Category "${tx.category}" is historically associated with higher fraud rates`);
  }

  // 7. New account making a high-value transaction
  const newAccountHighValue = tx.isNewAccount && tx.amount > 500;
  signals.newAccountHighValue = Boolean(newAccountHighValue);
  if (newAccountHighValue) {
    score += RISK_WEIGHTS.newAccountHighValue;
    reasons.push("New account attempting a high-value transaction");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level = "low";
  if (score >= 75) level = "critical";
  else if (score >= 50) level = "high";
  else if (score >= 25) level = "medium";

  return { score, level, reasons, signals };
}

/**
 * Score a batch of transactions and return both per-transaction results
 * and aggregate analytics, useful for dashboards.
 * @param {Transaction[]} transactions
 */
function scoreBatch(transactions) {
  const results = transactions.map((tx) => ({
    ...tx,
    fraud: scoreTransaction(tx),
  }));

  const total = results.length;
  const byLevel = { low: 0, medium: 0, high: 0, critical: 0 };
  let flaggedAmount = 0;
  let totalAmount = 0;
  const byCategory = {};
  const byCountry = {};
  const timeline = {}; // date -> { count, flagged }

  for (const r of results) {
    byLevel[r.fraud.level]++;
    totalAmount += r.amount;
    if (r.fraud.level === "high" || r.fraud.level === "critical") {
      flaggedAmount += r.amount;
    }

    byCategory[r.category] = byCategory[r.category] || { count: 0, flagged: 0 };
    byCategory[r.category].count++;
    if (r.fraud.level === "high" || r.fraud.level === "critical") {
      byCategory[r.category].flagged++;
    }

    byCountry[r.country] = byCountry[r.country] || { count: 0, flagged: 0 };
    byCountry[r.country].count++;
    if (r.fraud.level === "high" || r.fraud.level === "critical") {
      byCountry[r.country].flagged++;
    }

    const day = (r.timestamp || "").slice(0, 10);
    timeline[day] = timeline[day] || { date: day, count: 0, flagged: 0, avgScore: 0, scoreSum: 0 };
    timeline[day].count++;
    timeline[day].scoreSum += r.fraud.score;
    if (r.fraud.level === "high" || r.fraud.level === "critical") {
      timeline[day].flagged++;
    }
  }

  const timelineArr = Object.values(timeline)
    .map((d) => ({ ...d, avgScore: Math.round(d.scoreSum / d.count) }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  return {
    results,
    summary: {
      total,
      byLevel,
      flaggedCount: byLevel.high + byLevel.critical,
      flaggedRate: total ? Number(((byLevel.high + byLevel.critical) / total).toFixed(4)) : 0,
      totalAmount: Number(totalAmount.toFixed(2)),
      flaggedAmount: Number(flaggedAmount.toFixed(2)),
      byCategory,
      byCountry,
      timeline: timelineArr,
    },
  };
}

module.exports = { scoreTransaction, scoreBatch, zScore, mean, stdDev, RISK_WEIGHTS };
