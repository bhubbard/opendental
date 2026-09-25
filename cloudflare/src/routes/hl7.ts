import { Hono } from "hono";
import type { Env, HL7Message } from "../types.js";
import { recordSecurityLog } from "../utils/security-log.js";

export const hl7Routes = new Hono<{ Bindings: Env }>();

/**
 * Parses HL7 v2 messages and generates standard ACK (MSA) responses.
 * Ported from OpenDentBusiness/HL7/MessageParser.cs and MessageConstructor.cs.
 */
export function parseHL7Message(rawHL7: string) {
  const lines = rawHL7.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const segments: Record<string, string[]> = {};

  for (const line of lines) {
    const fields = line.split("|");
    const segName = fields[0];
    segments[segName] = fields;
  }

  // MSH Segment: MSH|^~\&|SENDING_APP|FACILITY|OPENDENTAL|CLINIC|20240924||ADT^A08|MSG001|P|2.3
  const msh = segments["MSH"] || [];
  const msgType = msh[8] || "UNKNOWN";
  const controlId = msh[9] || `MSG_${Date.now()}`;

  // PID Segment: PID|1||PAT123^^^OD||DOE^JOHN^M||19850101|M|||123 MAIN ST^^SAN FRANCISCO^CA^94102||555-0199
  const pid = segments["PID"] || [];
  const patIdField = pid[3] || "";
  const patNum = parseInt(patIdField.split("^")[0], 10) || 0;
  const nameField = (pid[5] || "").split("^");
  const lastName = nameField[0] || "";
  const firstName = nameField[1] || "";
  const middleName = nameField[2] || "";
  const dobRaw = pid[7] || "";
  const dob = dobRaw.length === 8 ? `${dobRaw.slice(0, 4)}-${dobRaw.slice(4, 6)}-${dobRaw.slice(6, 8)}` : "";
  const gender = pid[8] === "M" ? 1 : pid[8] === "F" ? 2 : 0;

  // SCH Segment (Scheduling): SCH|APT456|||||||||||20240924100000
  const sch = segments["SCH"] || [];
  const aptNum = parseInt((sch[1] || "").replace(/[^0-9]/g, ""), 10) || 0;

  return {
    msgType,
    controlId,
    patient: {
      patNum,
      lastName,
      firstName,
      middleName,
      dob,
      gender
    },
    aptNum,
    segments
  };
}

/**
 * Builds standard HL7 v2 ACK (MSA) response.
 */
export function buildHL7Ack(controlId: string, ackCode: "AA" | "AE" | "AR" = "AA", text: string = "Message accepted"): string {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return [
    `MSH|^~\\&|OPENDENTAL|CLINIC|SENDER|FACILITY|${timestamp}||ACK|${controlId}|P|2.3`,
    `MSA|${ackCode}|${controlId}|${text}`
  ].join("\r\n");
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

/**
 * POST /api/v1/hl7/receive
 * Ingests inbound HL7 v2 message (ADT A04/A08 patient demographic feed or SIU appointment feed)
 */
hl7Routes.post("/receive", async (c) => {
  const rawHL7 = await c.req.text();

  if (!rawHL7 || !rawHL7.includes("MSH|")) {
    return c.text("Invalid HL7 Message: Missing MSH segment", 400);
  }

  const parsed = parseHL7Message(rawHL7);

  // 1. Process Patient Information (ADT^A04 or ADT^A08)
  let patNum = parsed.patient.patNum;
  if (parsed.msgType.startsWith("ADT")) {
    if (patNum > 0) {
      // Update existing patient
      await c.env.DB.prepare(
        `UPDATE patient
         SET LName = COALESCE(NULLIF(?, ''), LName),
             FName = COALESCE(NULLIF(?, ''), FName),
             Birthdate = COALESCE(NULLIF(?, ''), Birthdate)
         WHERE PatNum = ?`
      ).bind(parsed.patient.lastName, parsed.patient.firstName, parsed.patient.dob, patNum).run();
    } else if (parsed.patient.lastName && parsed.patient.firstName) {
      // Insert new patient
      const res = await c.env.DB.prepare(
        `INSERT INTO patient (LName, FName, Birthdate, Gender, PatStatus, PriProv, ClinicNum)
         VALUES (?, ?, ?, ?, 0, 1, 1)`
      ).bind(parsed.patient.lastName, parsed.patient.firstName, parsed.patient.dob || "1980-01-01", parsed.patient.gender).run();
      patNum = res.meta.last_row_id as number;
    }
  }

  // 2. Store in hl7msg log
  await c.env.DB.prepare(
    `INSERT INTO hl7msg (MsgType, ControlID, PatNum, AptNum, HL7Status, MsgBody)
     VALUES (?, ?, ?, ?, 'Processed', ?)`
  ).bind(
    parsed.msgType,
    parsed.controlId,
    patNum,
    parsed.aptNum,
    rawHL7
  ).run();

  // 3. HIPAA Audit
  await recordSecurityLog(c.env.DB, {
    PermType: 17, // HL7Audit
    UserNum: 1,
    PatNum: patNum,
    FKey: 0,
    LogText: `HL7 ${parsed.msgType} processed successfully (ControlID: ${parsed.controlId})`
  });

  const ack = buildHL7Ack(parsed.controlId, "AA", `HL7 ${parsed.msgType} processed`);
  return c.text(ack, 200, {
    "Content-Type": "application/hl7-v2+er7"
  });
});
