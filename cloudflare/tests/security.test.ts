// Port of Open Dental MiddleTierTests.cs and ParamCheckTests.cs
// Source: UnitTests/MiddleTier/MiddleTierTests.cs
import { describe, it, expect } from "vitest";

describe("Open Dental - Security & MiddleTierTests", () => {
  function isReadOnlySafeSql(sql: string): { safe: boolean; reason?: string } {
    const trimmed = sql.trim();
    if (!trimmed) return { safe: false, reason: "Empty SQL string" };

    const normalized = trimmed.toUpperCase();

    // Must begin with SELECT or WITH
    if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
      return { safe: false, reason: "Query must start with SELECT or WITH" };
    }

    // Prohibited DDL and DML mutation keywords
    const prohibited = [
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+\w+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bDROP\s+TABLE\b/i,
      /\bALTER\s+TABLE\b/i,
      /\bTRUNCATE\b/i,
      /\bCREATE\s+TABLE\b/i
    ];

    for (const regex of prohibited) {
      if (regex.test(sql)) {
        return { safe: false, reason: `Query contains forbidden mutation command: ${regex}` };
      }
    }

    return { safe: true };
  }

  it("MiddleTier_ShortQuery_PermitsValidSelectQueries", () => {
    expect(isReadOnlySafeSql("SELECT * FROM patient WHERE PatNum = 1").safe).toBe(true);
    expect(isReadOnlySafeSql("WITH active_ops AS (SELECT * FROM operatory WHERE IsHidden = 0) SELECT * FROM active_ops").safe).toBe(true);
    expect(isReadOnlySafeSql("select LName, FName, Birthdate from patient order by LName").safe).toBe(true);
  });

  it("MiddleTier_ShortQuery_RejectsMutationCommands", () => {
    expect(isReadOnlySafeSql("DROP TABLE patient").safe).toBe(false);
    expect(isReadOnlySafeSql("DELETE FROM appointment WHERE AptNum = 5").safe).toBe(false);
    expect(isReadOnlySafeSql("INSERT INTO patient (LName, FName) VALUES ('Bad', 'Actor')").safe).toBe(false);
    expect(isReadOnlySafeSql("UPDATE patient SET LName = 'Hacked'").safe).toBe(false);
    expect(isReadOnlySafeSql("TRUNCATE TABLE procedurelog").safe).toBe(false);
  });

  it("MiddleTier_ShortQuery_RejectsMultiStatementInjections", () => {
    const malicious = "SELECT * FROM patient; DROP TABLE appointment;";
    // Even if it starts with SELECT, forbidden keyword is rejected
    expect(isReadOnlySafeSql(malicious).safe).toBe(false);
  });
});
