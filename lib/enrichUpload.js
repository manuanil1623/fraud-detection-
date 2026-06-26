// lib/enrichUpload.js
// Takes raw rows from an uploaded file (CSV/Excel/JSON, already converted
// to an array of plain objects by the client) plus a header->field mapping,
// and produces fully-formed transaction objects for scoreBatch().
//
// Uploaded files rarely include things like "this user's transaction
// history" or "known devices" directly — so we derive them from the file
// itself: for each row, look back at that same user's *earlier* rows
// (by timestamp) to build amount history, known devices, and velocity.

function parseAmount(v) {
  if (typeof v === "number") return v;
  const cleaned = String(v ?? "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseTimestamp(v) {
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Fallback: try parsing common "MM/DD/YYYY" style strings
  const parts = String(v).split(/[\/\-]/);
  if (parts.length === 3) {
    const d2 = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }
  return new Date().toISOString(); // last resort, keeps the row scoreable
}

function truthy(v) {
  if (typeof v === "boolean") return v;
  return ["true", "1", "yes", "y"].includes(String(v ?? "").toLowerCase());
}

/**
 * @param {Object[]} rows raw uploaded rows (array of plain objects, keys = original headers)
 * @param {Object} mapping field -> header name, from columnMapper.guessMapping (or user override)
 * @returns {Object[]} transactions ready for scoreBatch()
 */
function enrichUpload(rows, mapping) {
  // Step 1: normalize each row into a partial transaction using the mapping.
  const partial = rows.map((row, i) => ({
    id: mapping.id ? String(row[mapping.id]) : `row_${i + 1}`,
    userId: mapping.userId ? String(row[mapping.userId]) : "unknown_user",
    amount: parseAmount(mapping.amount ? row[mapping.amount] : 0),
    currency: mapping.currency ? row[mapping.currency] : "USD",
    timestamp: parseTimestamp(mapping.timestamp ? row[mapping.timestamp] : null),
    country: mapping.country ? String(row[mapping.country] || "") : "",
    homeCountry: mapping.homeCountry ? String(row[mapping.homeCountry] || "") : "",
    device: mapping.device ? String(row[mapping.device] || "") : "",
    category: mapping.category ? String(row[mapping.category] || "uncategorized") : "uncategorized",
    isNewAccount: mapping.isNewAccount ? truthy(row[mapping.isNewAccount]) : false,
  }));

  // If homeCountry wasn't supplied, assume each user's most common
  // transaction country is their "home" country (best guess from the data itself).
  if (!mapping.homeCountry) {
    const countryCounts = {}; // userId -> { country -> count }
    for (const tx of partial) {
      if (!tx.country) continue;
      countryCounts[tx.userId] = countryCounts[tx.userId] || {};
      countryCounts[tx.userId][tx.country] = (countryCounts[tx.userId][tx.country] || 0) + 1;
    }
    const mostCommon = {};
    for (const [userId, counts] of Object.entries(countryCounts)) {
      mostCommon[userId] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }
    for (const tx of partial) {
      tx.homeCountry = tx.homeCountry || mostCommon[tx.userId] || tx.country;
    }
  }

  // Step 2: sort chronologically so "history" only ever looks backwards in time.
  partial.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Step 3: walk through in order, building up per-user running state.
  const userState = {}; // userId -> { amounts: [], devices: Set, recentTimestamps: [] }
  const enriched = [];

  for (const tx of partial) {
    const state = userState[tx.userId] || { amounts: [], devices: new Set(), recentTimestamps: [] };

    // Velocity: how many of this user's prior transactions fall in the last hour.
    const oneHourMs = 60 * 60 * 1000;
    const txTime = new Date(tx.timestamp).getTime();
    const recentCount = state.recentTimestamps.filter((t) => txTime - t <= oneHourMs).length;

    enriched.push({
      ...tx,
      userHistoryAmounts: state.amounts.slice(-30),
      knownDevices: Array.from(state.devices),
      userTxCountLastHour: recentCount,
    });

    // Update state for subsequent transactions from this same user.
    state.amounts.push(tx.amount);
    if (tx.device) state.devices.add(tx.device);
    state.recentTimestamps.push(txTime);
    if (state.recentTimestamps.length > 50) state.recentTimestamps.shift();
    userState[tx.userId] = state;
  }

  return enriched;
}

module.exports = { enrichUpload, parseAmount, parseTimestamp };
