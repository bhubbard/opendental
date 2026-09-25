import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, OpenDentalJob } from "./types.js";
import { patientRoutes } from "./routes/patients.js";
import { appointmentRoutes } from "./routes/appointments.js";
import { procedureRoutes } from "./routes/procedures.js";
import { providerRoutes } from "./routes/providers.js";
import { documentRoutes } from "./routes/documents.js";
import { recallRoutes } from "./routes/recalls.js";
import { queryRoutes } from "./routes/queries.js";
import { perioRoutes } from "./routes/perio.js";
import { fhirRoutes } from "./routes/fhir.js";
import { handleQueueBatch } from "./queue/consumer.js";

// Export Durable Objects for Cloudflare runtime binding
export { AppointmentScheduleDO } from "./durable-objects/AppointmentScheduleDO.js";
export { ToothChartDO } from "./durable-objects/ToothChartDO.js";

const app = new Hono<{ Bindings: Env }>();

// CORS & Headers
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-OpenDental-Key"]
}));

// Global Audit Middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  c.header("X-OpenDental-Edge", "cloudflare-workers");
  c.header("X-Response-Time-Ms", String(duration));
});

// Health & System Info
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    service: "opendental-cf",
    version: "24.3.0",
    engine: "cloudflare-edge",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/v1/info", async (c) => {
  const patientCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM patient").first<{ count: number }>();
  const aptCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM appointment").first<{ count: number }>();

  return c.json({
    success: true,
    practiceName: c.env.PRACTICE_NAME || "Open Dental Cloud",
    version: "24.3.0",
    database: "Cloudflare D1 (SQLite)",
    stats: {
      activePatients: patientCount?.count ?? 0,
      totalAppointments: aptCount?.count ?? 0
    }
  });
});

// Real-Time WebSockets for Operatory Calendar
app.get("/ws/schedule", (c) => {
  const clinicId = c.req.query("clinicId") || "1";
  const doId = c.env.APPOINTMENT_SCHEDULE_DO.idFromName(`clinic-${clinicId}`);
  const stub = c.env.APPOINTMENT_SCHEDULE_DO.get(doId);
  return stub.fetch(c.req.raw);
});

// Real-Time WebSockets for Tooth Chart
app.get("/ws/chart/:patNum", (c) => {
  const patNum = c.req.param("patNum");
  const doId = c.env.TOOTH_CHART_DO.idFromName(`patient-${patNum}`);
  const stub = c.env.TOOTH_CHART_DO.get(doId);
  return stub.fetch(c.req.raw);
});

// Mount Open Dental REST API v1 routes
app.route("/api/v1/patients", patientRoutes);
app.route("/api/v1/appointments", appointmentRoutes);
app.route("/api/v1/procedurelogs", procedureRoutes);
app.route("/api/v1/providers", providerRoutes);
app.route("/api/v1/documents", documentRoutes);
app.route("/api/v1/recalls", recallRoutes);
app.route("/api/v1/queries", queryRoutes);
app.route("/api/v1/perio", perioRoutes);

// Mount ONC / FHIR R4 routes
app.route("/fhir/r4", fhirRoutes);

// Fallback to static web assets (Cloudflare Assets / Pages)
app.all("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Open Dental Cloudflare API running", 200);
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<OpenDentalJob>, env: Env): Promise<void> {
    await handleQueueBatch(batch, env);
  }
};
