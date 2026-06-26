// lib/columnMapper.js
// Given the column headers of an uploaded file, guess which header
// corresponds to each field the fraud engine needs. Users can override
// any guess in the UI before scoring.

const FIELD_HINTS = {
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

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Guess a header -> field mapping from a list of raw column headers.
 * Returns { fieldName: headerNameOrNull }.
 */
function guessMapping(headers) {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping = {};

  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    let found = null;
    for (const hint of hints) {
      const match = normalized.find((h) => h.norm === hint);
      if (match) {
        found = match.raw;
        break;
      }
    }
    // Fallback: partial match (e.g. header "user_amount_usd" contains "amount")
    if (!found) {
      for (const hint of hints) {
        const match = normalized.find((h) => h.norm.includes(hint));
        if (match) {
          found = match.raw;
          break;
        }
      }
    }
    mapping[field] = found;
  }

  return mapping;
}

const REQUIRED_FIELDS = ["userId", "amount", "timestamp"];

function missingRequired(mapping) {
  return REQUIRED_FIELDS.filter((f) => !mapping[f]);
}

module.exports = { guessMapping, FIELD_HINTS, REQUIRED_FIELDS, missingRequired };
