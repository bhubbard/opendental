import { Hono } from "hono";
import type { Env, Sheet, SheetField } from "../types.js";
import { recordSecurityLog } from "../utils/security-log.js";

export const sheetRoutes = new Hono<{ Bindings: Env }>();

/**
 * Standard templates matching OpenDentBusiness/SheetFramework/SheetsInternal.cs.
 */
const TEMPLATES = [
  {
    type: 1,
    name: "Patient Registration & Medical History",
    fields: [
      { name: "EmergencyContactName", type: 1, required: true },
      { name: "EmergencyContactPhone", type: 1, required: true },
      { name: "HasHeartTrouble", type: 2, required: false },
      { name: "HasHighBloodPressure", type: 2, required: false },
      { name: "HasPenicillinAllergy", type: 2, required: false },
      { name: "HasLatexAllergy", type: 2, required: false },
      { name: "IsPregnant", type: 2, required: false },
      { name: "CurrentMedications", type: 1, required: false },
      { name: "PatientSignature", type: 3, required: true }
    ]
  },
  {
    type: 3,
    name: "General Dental Treatment & Anesthesia Consent",
    fields: [
      { name: "ConsentAcknowledge", type: 2, required: true },
      { name: "PatientSignature", type: 3, required: true }
    ]
  }
];

sheetRoutes.get("/templates", (c) => {
  return c.json({ templates: TEMPLATES });
});

/**
 * POST /api/v1/sheets/submit
 * Submits a completed eClipboard / Web intake sheet with digital signature
 */
sheetRoutes.post("/submit", async (c) => {
  const body = await c.req.json<{
    PatNum: number;
    SheetType: number;
    Description: string;
    Fields: Record<string, string>;
    SignatureData?: string; // Base64 signature vector / canvas data
  }>();

  if (!body.PatNum || !body.SheetType || !body.Fields) {
    return c.json({ error: "PatNum, SheetType, and Fields are required" }, 400);
  }

  const isSigned = body.SignatureData ? 1 : 0;

  // Insert Sheet record
  const sheetRes = await c.env.DB.prepare(
    `INSERT INTO sheet (SheetType, PatNum, Description, IsWebForm, SignedStatus, SignatureData)
     VALUES (?, ?, ?, 1, ?, ?)`
  ).bind(
    body.SheetType,
    body.PatNum,
    body.Description || "Patient Intake Form",
    isSigned,
    body.SignatureData || ""
  ).run();

  const sheetNum = sheetRes.meta.last_row_id as number;

  // Insert SheetField records
  for (const [key, value] of Object.entries(body.Fields)) {
    await c.env.DB.prepare(
      `INSERT INTO sheetfield (SheetNum, FieldType, FieldName, FieldValue)
       VALUES (?, 1, ?, ?)`
    ).bind(sheetNum, key, String(value)).run();
  }

  // HIPAA Security Audit
  await recordSecurityLog(c.env.DB, {
    PermType: 16, // SheetEdit/Create
    UserNum: 1,
    PatNum: body.PatNum,
    FKey: sheetNum,
    LogText: `Digital Form '${body.Description}' completed via eClipboard/Web. Signed: ${isSigned === 1 ? "YES" : "NO"}`
  });

  return c.json({
    success: true,
    SheetNum: sheetNum,
    PatNum: body.PatNum,
    Signed: isSigned === 1
  }, 201);
});

/**
 * GET /api/v1/sheets/patient/:PatNum
 * Retrieves all digital forms and intake sheets for a patient
 */
sheetRoutes.get("/patient/:PatNum", async (c) => {
  const patNum = parseInt(c.req.param("PatNum"), 10);

  const sheets = await c.env.DB.prepare(
    `SELECT * FROM sheet WHERE PatNum = ? ORDER BY DateTimeSheet DESC`
  ).bind(patNum).all<Sheet>();

  const result = [];
  for (const s of sheets.results) {
    const fields = await c.env.DB.prepare(
      `SELECT * FROM sheetfield WHERE SheetNum = ?`
    ).bind(s.SheetNum).all<SheetField>();

    result.push({
      ...s,
      fields: fields.results
    });
  }

  return c.json({ sheets: result });
});
