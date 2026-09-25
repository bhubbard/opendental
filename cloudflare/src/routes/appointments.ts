import { Hono } from "hono";
import type { Env, Appointment } from "../types.js";

export const appointmentRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/appointments - List by date or range
appointmentRoutes.get("/", async (c) => {
  const date = c.req.query("date") || new Date().toISOString().split("T")[0];
  const op = c.req.query("op");
  const clinicId = c.req.query("clinicId") || "1";

  let sql = `
    SELECT 
      a.*,
      p.LName || ', ' || p.FName as PatientName,
      p.WirelessPhone as PatientPhone,
      o.OpName,
      pr.Abbr as ProvAbbr
    FROM appointment a
    JOIN patient p ON a.PatNum = p.PatNum
    JOIN operatory o ON a.Op = o.OperatoryNum
    JOIN provider pr ON a.ProvNum = pr.ProvNum
    WHERE date(a.AptDateTime) = date(?)
  `;
  const params: unknown[] = [date];

  if (op) {
    sql += " AND a.Op = ?";
    params.push(Number(op));
  }

  if (clinicId) {
    sql += " AND a.ClinicNum = ?";
    params.push(Number(clinicId));
  }

  sql += " ORDER BY a.AptDateTime ASC";

  const result = await c.env.DB.prepare(sql).bind(...params).all<Appointment>();

  return c.json({
    success: true,
    date,
    count: result.results.length,
    appointments: result.results
  });
});

// POST /api/v1/appointments - Create and broadcast
appointmentRoutes.post("/", async (c) => {
  const body = await c.req.json<Partial<Appointment>>();

  if (!body.PatNum || !body.Op || !body.ProvNum || !body.AptDateTime) {
    return c.json({
      success: false,
      error: "PatNum, Op, ProvNum, and AptDateTime are required"
    }, 400);
  }

  // Conflict check: Check if operatory is already booked at that time
  const conflict = await c.env.DB.prepare(`
    SELECT AptNum FROM appointment 
    WHERE Op = ? 
      AND AptDateTime = ? 
      AND AptStatus NOT IN (5, 6) -- not broken or planned
  `).bind(body.Op, body.AptDateTime).first<{ AptNum: number }>();

  if (conflict) {
    return c.json({
      success: false,
      error: "OPERATORY_CONFLICT",
      message: `Operatory ${body.Op} is already booked at ${body.AptDateTime}`
    }, 409);
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO appointment (
      PatNum, AptStatus, Pattern, Op, Note, ProvNum, ProvHyg,
      AptDateTime, ProcDescript, ClinicNum, IsHygiene
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.PatNum,
    body.AptStatus ?? 1,
    body.Pattern || '/XX/',
    body.Op,
    body.Note || '',
    body.ProvNum,
    body.ProvHyg || 0,
    body.AptDateTime,
    body.ProcDescript || '',
    body.ClinicNum || 1,
    body.IsHygiene ?? 0
  ).run();

  const newAptNum = result.meta.last_row_id;

  // Broadcast to Durable Object to update all operatory screens in real time
  try {
    const doId = c.env.APPOINTMENT_SCHEDULE_DO.idFromName(`clinic-${body.ClinicNum || 1}`);
    const stub = c.env.APPOINTMENT_SCHEDULE_DO.get(doId);
    await stub.fetch("https://internal/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "APPOINTMENT_CREATED",
        appointment: { ...body, AptNum: newAptNum }
      })
    });
  } catch {
    // Non-fatal if DO broadcast fails
  }

  return c.json({
    success: true,
    AptNum: newAptNum,
    message: "Appointment created successfully"
  }, 201);
});

// PUT /api/v1/appointments/:id - Update status or move
appointmentRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<Partial<Appointment>>();

  await c.env.DB.prepare(`
    UPDATE appointment SET
      AptStatus = COALESCE(?, AptStatus),
      Op = COALESCE(?, Op),
      AptDateTime = COALESCE(?, AptDateTime),
      Pattern = COALESCE(?, Pattern),
      Note = COALESCE(?, Note),
      Confirmed = COALESCE(?, Confirmed),
      DateTimeArrived = COALESCE(?, DateTimeArrived),
      DateTimeSeated = COALESCE(?, DateTimeSeated),
      DateTimeDismissed = COALESCE(?, DateTimeDismissed),
      DateTStamp = CURRENT_TIMESTAMP
    WHERE AptNum = ?
  `).bind(
    body.AptStatus ?? null,
    body.Op ?? null,
    body.AptDateTime ?? null,
    body.Pattern ?? null,
    body.Note ?? null,
    body.Confirmed ?? null,
    body.DateTimeArrived ?? null,
    body.DateTimeSeated ?? null,
    body.DateTimeDismissed ?? null,
    id
  ).run();

  // Broadcast update
  try {
    const doId = c.env.APPOINTMENT_SCHEDULE_DO.idFromName(`clinic-${body.ClinicNum || 1}`);
    const stub = c.env.APPOINTMENT_SCHEDULE_DO.get(doId);
    await stub.fetch("https://internal/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "APPOINTMENT_UPDATED",
        AptNum: id,
        updates: body
      })
    });
  } catch {
    // Non-fatal
  }

  return c.json({ success: true, message: `Appointment ${id} updated` });
});
