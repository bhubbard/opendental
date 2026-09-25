import { Hono } from "hono";
import type { Env } from "../types.js";

export const queryRoutes = new Hono<{ Bindings: Env }>();

// POST /api/v1/queries/ShortQuery - Open Dental SQL Reporting Endpoint
queryRoutes.post("/ShortQuery", async (c) => {
  const body = await c.req.json<{ SqlCommand?: string; sql?: string }>();
  const sql = (body.SqlCommand || body.sql || "").trim();

  if (!sql) {
    return c.json({ success: false, error: "SqlCommand is required" }, 400);
  }

  // Safety guardrail: Only allow SELECT statements (no mutations via ShortQuery)
  const normalized = sql.toUpperCase();
  if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
    return c.json({
      success: false,
      error: "UNAUTHORIZED_SQL",
      message: "ShortQuery endpoint only permits read-only SELECT queries"
    }, 403);
  }

  try {
    const result = await c.env.DB.prepare(sql).all();
    return c.json({
      success: true,
      rowCount: result.results.length,
      data: result.results
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json({
      success: false,
      error: "SQL_SYNTAX_ERROR",
      details: errorMsg
    }, 400);
  }
});
