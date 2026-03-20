function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  const allowOrigin = process.env.ALLOW_ORIGIN || "*";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.AIRTABLE_ACCESS_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME;

  if (!token || !baseId || !tableName) {
    return res.status(500).json({ error: "Server is not configured" });
  }

  const body = parseJsonBody(req);
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const goal = String(body.goal || "").trim();
  const submittedAt = String(body.submittedAt || new Date().toISOString());
  const source = String(body.source || "github-pages-waitlist");

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) {
    return res.status(400).json({ error: "Invalid email" });
  }

  // Defaults match common lowercase/camelCase Airtable schemas (see .env.example).
  const airtableFieldName = process.env.AIRTABLE_FIELD_NAME || "name";
  const airtableFieldEmail = process.env.AIRTABLE_FIELD_EMAIL || "email";
  /** Form "goal" maps here — your base uses "Signup Summary" for notes. */
  const airtableFieldGoal =
    process.env.AIRTABLE_FIELD_GOAL || "Signup Summary";
  const airtableFieldSubmittedAt =
    process.env.AIRTABLE_FIELD_SUBMITTED_AT || "submittedAt";
  const airtableFieldSource = process.env.AIRTABLE_FIELD_SOURCE || "source";

  /** Only include fields with values — empty strings can break some Airtable field types. */
  const fields = {
    [airtableFieldName]: name,
    [airtableFieldEmail]: email,
  };
  if (goal) {
    fields[airtableFieldGoal] = goal;
  }
  if (process.env.AIRTABLE_OMIT_SUBMITTED_AT !== "true") {
    fields[airtableFieldSubmittedAt] = submittedAt;
  }
  if (process.env.AIRTABLE_OMIT_SOURCE !== "true") {
    fields[airtableFieldSource] = source;
  }

  try {
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [{ fields }],
          typecast: true,
        }),
      }
    );

    if (!airtableResponse.ok) {
      const raw = await airtableResponse.text();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
      const airtableError =
        parsed && typeof parsed === "object" && parsed.error
          ? parsed.error
          : null;
      const message =
        airtableError?.message ||
        (typeof parsed === "string" ? parsed : JSON.stringify(parsed));
      const clientStatus =
        airtableResponse.status === 422 || airtableResponse.status === 403
          ? 400
          : 502;
      return res.status(clientStatus).json({
        error: "Failed to write to Airtable",
        message,
        airtableStatus: airtableResponse.status,
        details: parsed,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Unexpected server error" });
  }
};
