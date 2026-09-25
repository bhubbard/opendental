import { Hono } from "hono";
import type { Env, ProcedureLog, ProcedureCode } from "../types.js";

export const procedureRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/procedurecodes - List CDT codes with KV edge caching
procedureRoutes.get("/codes", async (c) => {
  const cacheKey = "cdt_codes_list_v1";

  // Check KV cache
  try {
    const cached = await c.env.OPENDENTAL_KV.get(cacheKey, "json");
    if (cached) {
      return c.json({ success: true, source: "kv_cache", codes: cached });
    }
  } catch {
    // Fall back to D1
  }

  const result = await c.env.DB.prepare(`
    SELECT pc.*, COALESCE(f.Amount, 0) as DefaultFee
    FROM procedurecode pc
    LEFT JOIN fee f ON pc.CodeNum = f.CodeNum AND f.FeeSchedNum = 1
    ORDER BY pc.ProcCode ASC
  `).all<ProcedureCode>();

  // Store in KV cache for 24 hours
  try {
    await c.env.OPENDENTAL_KV.put(cacheKey, JSON.stringify(result.results), {
      expirationTtl: 86400
    });
  } catch {
    // Non-fatal
  }

  return c.json({
    success: true,
    source: "d1_database",
    count: result.results.length,
    codes: result.results
  });
});

// GET /api/v1/procedurelogs - List procedures for patient
procedureRoutes.get("/logs", async (c) => {
  const patNum = c.req.query("patNum");
  if (!patNum) return c.json({ success: false, error: "patNum query parameter required" }, 400);

  const result = await c.env.DB.prepare(`
    SELECT 
      pl.*,
      pc.ProcCode,
      pc.Descript,
      pr.Abbr as ProvAbbr
    FROM procedurelog pl
    JOIN procedurecode pc ON pl.CodeNum = pc.CodeNum
    JOIN provider pr ON pl.ProvNum = pr.ProvNum
    WHERE pl.PatNum = ?
    ORDER BY pl.ProcDate DESC, pl.ProcNum DESC
  `).bind(Number(patNum)).all<ProcedureLog>();

  return c.json({
    success: true,
    patNum: Number(patNum),
    count: result.results.length,
    procedures: result.results
  });
});

// POST /api/v1/procedurelogs - Add procedure to chart/treatment plan
procedureRoutes.post("/logs", async (c) => {
  const body = await c.req.json<Partial<ProcedureLog>>();

  if (!body.PatNum || !body.CodeNum || !body.ProvNum) {
    return c.json({ success: false, error: "PatNum, CodeNum, and ProvNum are required" }, 400);
  }

  // Auto-lookup standard fee if not provided
  let fee = body.ProcFee;
  if (fee === undefined) {
    const feeRow = await c.env.DB.prepare(
      "SELECT Amount FROM fee WHERE CodeNum = ? AND FeeSchedNum = 1"
    ).bind(body.CodeNum).first<{ Amount: number }>();
    fee = feeRow ? feeRow.Amount : 0;
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO procedurelog (
      PatNum, AptNum, CodeNum, ProcDate, ProcFee,
      Surf, ToothNum, ToothRange, Priority, ProcStatus,
      ProvNum, ClinicNum, BillingNote
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.PatNum,
    body.AptNum || 0,
    body.CodeNum,
    body.ProcDate || new Date().toISOString().split("T")[0],
    fee,
    body.Surf || '',
    body.ToothNum || '',
    body.ToothRange || '',
    body.Priority || 0,
    body.ProcStatus ?? 1, // Default: 1=TreatmentPlan
    body.ProvNum,
    body.ClinicNum || 1,
    body.BillingNote || ''
  ).run();

  return c.json({
    success: true,
    ProcNum: result.meta.last_row_id,
    message: "Procedure logged successfully"
  }, 201);
});
