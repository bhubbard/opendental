import { Hono } from "hono";
import type { Env, Patient } from "../types.js";

export const patientRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/patients - Search or list
patientRoutes.get("/", async (c) => {
  const name = c.req.query("name");
  const phone = c.req.query("phone");
  const limit = Math.min(Number(c.req.query("limit") || 50), 100);
  const offset = Number(c.req.query("offset") || 0);

  let query = "SELECT * FROM patient WHERE PatStatus = 0";
  const params: unknown[] = [];

  if (name) {
    query += " AND (LName LIKE ? OR FName LIKE ? OR Preferred LIKE ?)";
    const wildcard = `%${name}%`;
    params.push(wildcard, wildcard, wildcard);
  }

  if (phone) {
    query += " AND (WirelessPhone LIKE ? OR HmPhone LIKE ?)";
    const phoneWildcard = `%${phone}%`;
    params.push(phoneWildcard, phoneWildcard);
  }

  query += " ORDER BY LName, FName LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const stmt = c.env.DB.prepare(query);
  const result = await stmt.bind(...params).all<Patient>();

  return c.json({
    success: true,
    count: result.results.length,
    patients: result.results
  });
});

// GET /api/v1/patients/:id - Single patient
patientRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ success: false, error: "Invalid patient ID" }, 400);

  const patient = await c.env.DB.prepare("SELECT * FROM patient WHERE PatNum = ?")
    .bind(id)
    .first<Patient>();

  if (!patient) return c.json({ success: false, error: "Patient not found" }, 404);

  // Fetch pending treatment plan summary
  const tpSummary = await c.env.DB.prepare(`
    SELECT COUNT(*) as TpCount, COALESCE(SUM(ProcFee), 0) as TpTotal
    FROM procedurelog 
    WHERE PatNum = ? AND ProcStatus = 1
  `).bind(id).first<{ TpCount: number; TpTotal: number }>();

  return c.json({
    success: true,
    patient,
    treatmentPlanSummary: tpSummary
  });
});

// POST /api/v1/patients - Create new patient
patientRoutes.post("/", async (c) => {
  const body = await c.req.json<Partial<Patient>>();

  if (!body.LName || !body.FName || !body.Birthdate) {
    return c.json({ success: false, error: "LName, FName, and Birthdate are required" }, 400);
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO patient (
      LName, FName, MiddleI, Preferred, PatStatus, Gender, Position,
      Birthdate, SSN, Address, Address2, City, State, Zip,
      HmPhone, WkPhone, WirelessPhone, Email, PriProv, ClinicNum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.LName,
    body.FName,
    body.MiddleI || '',
    body.Preferred || body.FName,
    body.PatStatus ?? 0,
    body.Gender ?? 0,
    body.Position ?? 0,
    body.Birthdate,
    body.SSN || '',
    body.Address || '',
    body.Address2 || '',
    body.City || '',
    body.State || '',
    body.Zip || '',
    body.HmPhone || '',
    body.WkPhone || '',
    body.WirelessPhone || '',
    body.Email || '',
    body.PriProv || 1,
    body.ClinicNum || 1
  ).run();

  const newId = result.meta.last_row_id;
  return c.json({ success: true, PatNum: newId, message: "Patient created successfully" }, 201);
});

// PUT /api/v1/patients/:id - Update patient
patientRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<Partial<Patient>>();

  await c.env.DB.prepare(`
    UPDATE patient SET
      LName = COALESCE(?, LName),
      FName = COALESCE(?, FName),
      Preferred = COALESCE(?, Preferred),
      WirelessPhone = COALESCE(?, WirelessPhone),
      Email = COALESCE(?, Email),
      Address = COALESCE(?, Address),
      City = COALESCE(?, City),
      State = COALESCE(?, State),
      Zip = COALESCE(?, Zip),
      DateTStamp = CURRENT_TIMESTAMP
    WHERE PatNum = ?
  `).bind(
    body.LName ?? null,
    body.FName ?? null,
    body.Preferred ?? null,
    body.WirelessPhone ?? null,
    body.Email ?? null,
    body.Address ?? null,
    body.City ?? null,
    body.State ?? null,
    body.Zip ?? null,
    id
  ).run();

  return c.json({ success: true, message: `Patient ${id} updated` });
});
