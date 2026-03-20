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

  const body = req.body || {};
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

  const airtableFieldName = process.env.AIRTABLE_FIELD_NAME || "Name";
  const airtableFieldEmail = process.env.AIRTABLE_FIELD_EMAIL || "Email";
  const airtableFieldGoal = process.env.AIRTABLE_FIELD_GOAL || "Goal";
  const airtableFieldSubmittedAt =
    process.env.AIRTABLE_FIELD_SUBMITTED_AT || "Submitted At";
  const airtableFieldSource = process.env.AIRTABLE_FIELD_SOURCE || "Source";

  const fields = {
    [airtableFieldName]: name,
    [airtableFieldEmail]: email,
    [airtableFieldGoal]: goal,
    [airtableFieldSubmittedAt]: submittedAt,
    [airtableFieldSource]: source,
  };

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
      const details = await airtableResponse.text();
      return res.status(502).json({
        error: "Failed to write to Airtable",
        details,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Unexpected server error" });
  }
};
