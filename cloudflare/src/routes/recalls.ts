import { Hono } from "hono";
import type { Env, OpenDentalJob } from "../types.js";

export const recallRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/recalls - Due recalls
recallRoutes.get("/", async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT 
      r.*,
      p.LName,
      p.FName,
      p.WirelessPhone,
      p.Email
    FROM recall r
    JOIN patient p ON r.PatNum = p.PatNum
    WHERE r.DateDue <= date('now', '+30 days')
      AND r.RecallStatus = 0
    ORDER BY r.DateDue ASC
  `).all();

  return c.json({
    success: true,
    count: result.results.length,
    recalls: result.results
  });
});

// POST /api/v1/recalls/trigger-batch - Enqueue recall batch to Cloudflare Queue
recallRoutes.post("/trigger-batch", async (c) => {
  const recalls = await c.env.DB.prepare(`
    SELECT r.RecallNum, r.PatNum, r.DateDue, p.FName, p.WirelessPhone, p.Email
    FROM recall r
    JOIN patient p ON r.PatNum = p.PatNum
    WHERE r.DateDue <= date('now', '+30 days')
      AND r.RecallStatus = 0
    LIMIT 25
  `).all<{ RecallNum: number; PatNum: number; DateDue: string; FName: string; WirelessPhone: string; Email: string }>();

  let enqueued = 0;
  for (const item of recalls.results) {
    const job: OpenDentalJob = {
      type: "RECALL_REMINDER",
      payload: {
        recallNum: item.RecallNum,
        patNum: item.PatNum,
        patientName: item.FName,
        phone: item.WirelessPhone,
        dateDue: item.DateDue
      },
      timestamp: new Date().toISOString()
    };

    try {
      await c.env.OPENDENTAL_QUEUE.send(job);
      enqueued++;
    } catch {
      // Non-fatal
    }
  }

  return c.json({
    success: true,
    enqueuedCount: enqueued,
    message: `Enqueued ${enqueued} recall reminder jobs to Cloudflare Queue`
  });
});
