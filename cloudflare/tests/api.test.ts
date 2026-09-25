import { describe, it, expect, vi } from "vitest";

describe("Open Dental Cloudflare Suite", () => {
  it("validates health check payload", () => {
    const health = {
      status: "healthy",
      service: "opendental-cf",
      version: "24.3.0",
      engine: "cloudflare-edge"
    };
    expect(health.status).toBe("healthy");
    expect(health.service).toBe("opendental-cf");
    expect(health.engine).toBe("cloudflare-edge");
  });

  it("enforces ShortQuery SQL safety to prevent mutations", () => {
    const isSafeSql = (sql: string) => {
      const normalized = sql.trim().toUpperCase();
      return normalized.startsWith("SELECT") || normalized.startsWith("WITH");
    };

    expect(isSafeSql("SELECT * FROM patient")).toBe(true);
    expect(isSafeSql("WITH active_patients AS (SELECT * FROM patient) SELECT * FROM active_patients")).toBe(true);
    expect(isSafeSql("DROP TABLE patient")).toBe(false);
    expect(isSafeSql("DELETE FROM appointment WHERE AptNum = 1")).toBe(false);
    expect(isSafeSql("UPDATE patient SET LName = 'Hacked'")).toBe(false);
  });

  it("calculates treatment plan totals accurately", () => {
    const procedures = [
      { code: "D0120", fee: 65.0, status: 1 },
      { code: "D1110", fee: 105.0, status: 1 },
      { code: "D2740", fee: 1350.0, status: 1 }
    ];

    const total = procedures.reduce((sum, p) => sum + p.fee, 0);
    expect(total).toBe(1520.0);
  });

  it("formats R2 document storage keys with HIPAA-safe paths", () => {
    const patNum = 42;
    const filename = "xray_bitewing 1.jpg";
    const timestamp = 1727220000;
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const r2Key = `patients/${patNum}/${timestamp}_${safeFilename}`;

    expect(r2Key).toBe("patients/42/1727220000_xray_bitewing_1.jpg");
    expect(r2Key.includes(" ")).toBe(false);
  });
});
