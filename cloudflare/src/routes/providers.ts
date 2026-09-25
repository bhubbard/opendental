import { Hono } from "hono";
import type { Env, Provider, Operatory, Clinic } from "../types.js";

export const providerRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/providers
providerRoutes.get("/", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT * FROM provider WHERE IsHidden = 0 ORDER BY ItemOrder, LName"
  ).all<Provider>();

  return c.json({ success: true, count: result.results.length, providers: result.results });
});

// GET /api/v1/operatories
providerRoutes.get("/operatories", async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT o.*, p1.Abbr as DentistAbbr, p2.Abbr as HygAbbr
    FROM operatory o
    LEFT JOIN provider p1 ON o.ProvDentist = p1.ProvNum
    LEFT JOIN provider p2 ON o.ProvHygienist = p2.ProvNum
    WHERE o.IsHidden = 0
    ORDER BY o.ItemOrder, o.OpName
  `).all<Operatory>();

  return c.json({ success: true, count: result.results.length, operatories: result.results });
});

// GET /api/v1/clinics
providerRoutes.get("/clinics", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT * FROM clinic ORDER BY ClinicNum"
  ).all<Clinic>();

  return c.json({ success: true, count: result.results.length, clinics: result.results });
});
