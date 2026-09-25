import { Hono } from "hono";
import type { Env } from "../types.js";
import { generateEDI837D } from "../utils/edi837d.js";
import { recordSecurityLog } from "../utils/security-log.js";

export const claimRoutes = new Hono<{ Bindings: Env }>();

/**
 * Parses ANSI X12 835 Electronic Remittance Advice (ERA) content.
 * Ported from OpenDentBusiness/X12/X835.cs.
 */
export function parseX12_835(x12Content: string) {
  const clean = x12Content.replace(/\r?\n/g, "");
  const segments = clean.split("~").map(s => s.trim()).filter(Boolean);

  let payerName = "Dental Clearinghouse Payer";
  let payerId = "PAYER01";
  let checkOrEftTrace = "";
  let totalPaid = 0.0;
  let paidDate = new Date().toISOString().split("T")[0];
  const claimPayments: Array<{
    claimNum: number;
    claimStatusCode: string;
    totalCharge: number;
    paidAmount: number;
    patientResponsibility: number;
    writeOff: number;
  }> = [];

  for (const seg of segments) {
    const fields = seg.split("*");
    const tag = fields[0];

    if (tag === "BPR") {
      // BPR*I*1500.00*C*ACH*CTX*...*20240924~
      totalPaid = parseFloat(fields[2]) || 0;
      if (fields[16] && fields[16].length === 8) {
        paidDate = `${fields[16].substring(0, 4)}-${fields[16].substring(4, 6)}-${fields[16].substring(6, 8)}`;
      }
    } else if (tag === "TRN") {
      // TRN*1*TRACE12345678*...~
      checkOrEftTrace = fields[2] || "";
    } else if (tag === "N1" && fields[1] === "PR") {
      // N1*PR*Delta Dental*XX*123456789~
      payerName = fields[2] || payerName;
      payerId = fields[4] || payerId;
    } else if (tag === "CLP") {
      // CLP*ClaimNum*StatusCode*TotalCharge*PaidAmt*PatientResp*...~
      // e.g. CLP*1*1*250.00*200.00*50.00~
      const claimNum = parseInt(fields[1], 10);
      const claimStatusCode = fields[2] || "1";
      const totalCharge = parseFloat(fields[3]) || 0;
      const paidAmount = parseFloat(fields[4]) || 0;
      const patientResponsibility = parseFloat(fields[5]) || 0;
      const writeOff = Math.max(0, totalCharge - paidAmount - patientResponsibility);

      if (!isNaN(claimNum)) {
        claimPayments.push({
          claimNum,
          claimStatusCode,
          totalCharge,
          paidAmount,
          patientResponsibility,
          writeOff
        });
      }
    }
  }

  return {
    payerName,
    payerId,
    checkOrEftTrace,
    totalPaid,
    paidDate,
    claims: claimPayments
  };
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

/**
 * POST /api/v1/claims
 * Create a new dental insurance claim for completed procedures
 */
claimRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    PatNum: number;
    PlanNum: number;
    ProcNums: number[];
    ClaimType?: "P" | "S";
  }>();

  if (!body.PatNum || !body.PlanNum || !body.ProcNums || body.ProcNums.length === 0) {
    return c.json({ error: "PatNum, PlanNum, and ProcNums are required" }, 400);
  }

  const dateService = new Date().toISOString().split("T")[0];

  // Calculate total claim fee from procedures
  const placeholders = body.ProcNums.map(() => "?").join(",");
  const procs = await c.env.DB.prepare(
    `SELECT ProcNum, ProcFee, ProvNum, ClinicNum FROM procedurelog WHERE ProcNum IN (${placeholders})`
  ).bind(...body.ProcNums).all<{ ProcNum: number; ProcFee: number; ProvNum: number; ClinicNum?: number }>();

  let totalFee = 0;
  for (const p of procs.results) {
    totalFee += p.ProcFee;
  }

  const claimRes = await c.env.DB.prepare(
    `INSERT INTO claim (PatNum, DateService, ClaimStatus, ClaimType, PlanNum, ClaimFee, InsPayEst, ClinicNum)
     VALUES (?, ?, 'W', ?, ?, ?, ?, ?)`
  ).bind(
    body.PatNum,
    dateService,
    body.ClaimType || "P",
    body.PlanNum,
    totalFee,
    totalFee * 0.8, // Default 80% estimate
    procs.results[0]?.ClinicNum || 0
  ).run();

  const claimNum = claimRes.meta.last_row_id as number;

  // Insert ClaimProc entries
  for (const p of procs.results) {
    await c.env.DB.prepare(
      `INSERT INTO claimproc (ClaimNum, ProcNum, PatNum, PlanNum, InsPayEst, FeeBilled, Status)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).bind(
      claimNum,
      p.ProcNum,
      body.PatNum,
      body.PlanNum,
      p.ProcFee * 0.8,
      p.ProcFee
    ).run();
  }

  return c.json({
    success: true,
    ClaimNum: claimNum,
    PatNum: body.PatNum,
    ClaimFee: totalFee,
    ProcedureCount: body.ProcNums.length
  }, 201);
});

/**
 * GET /api/v1/claims/patient/:PatNum
 * Retrieves all claims and adjudication status for a patient
 */
claimRoutes.get("/patient/:PatNum", async (c) => {
  const patNum = parseInt(c.req.param("PatNum"), 10);

  const claims = await c.env.DB.prepare(
    `SELECT c.*, car.CarrierName, car.ElectID
     FROM claim c
     JOIN insplan ip ON c.PlanNum = ip.PlanNum
     JOIN carrier car ON ip.CarrierNum = car.CarrierNum
     WHERE c.PatNum = ?
     ORDER BY c.DateService DESC, c.ClaimNum DESC`
  ).bind(patNum).all();

  return c.json({ claims: claims.results });
});

/**
 * POST /api/v1/claims/:ClaimNum/edi837d
 * Generates an ANSI X12 837D Dental Claim transaction string
 */
claimRoutes.post("/:ClaimNum/edi837d", async (c) => {
  const claimNum = parseInt(c.req.param("ClaimNum"), 10);

  const claim = await c.env.DB.prepare(
    `SELECT c.*, p.LName as PatLName, p.FName as PatFName, p.Birthdate as PatDOB, p.Gender as PatGender,
            car.CarrierName, car.PayerID, car.ElectID,
            pr.LName as ProvLName, pr.FName as ProvFName, pr.NationalProvID, pr.StateLicense
     FROM claim c
     JOIN patient p ON c.PatNum = p.PatNum
     JOIN insplan ip ON c.PlanNum = ip.PlanNum
     JOIN carrier car ON ip.CarrierNum = car.CarrierNum
     LEFT JOIN provider pr ON pr.ProvNum = 1
     WHERE c.ClaimNum = ?`
  ).bind(claimNum).first<any>();

  if (!claim) {
    return c.json({ error: "Claim not found" }, 404);
  }

  const procs = await c.env.DB.prepare(
    `SELECT cp.*, pl.ProcDate, pl.Surf, pl.ToothNum, pc.ProcCode, pc.Descript
     FROM claimproc cp
     JOIN procedurelog pl ON cp.ProcNum = pl.ProcNum
     JOIN procedurecode pc ON pl.CodeNum = pc.CodeNum
     WHERE cp.ClaimNum = ?`
  ).bind(claimNum).all<any>();

  const ediContent = generateEDI837D({
    claimId: claim.ClaimNum,
    dateOfService: claim.DateService,
    totalFee: claim.ClaimFee,
    carrierPayerId: claim.ElectID || claim.PayerID || "00431",
    billingProvider: {
      npi: claim.NationalProvID || "1234567890",
      taxId: "94-1234567",
      name: `${claim.ProvLName || "Dentist"}, ${claim.ProvFName || "Doctor"} DDS`,
      address: "100 Medical Center Blvd",
      city: "San Francisco",
      state: "CA",
      zip: "94102"
    },
    subscriber: {
      memberId: `PAT-${claim.PatNum}`,
      lastName: claim.PatLName || "Doe",
      firstName: claim.PatFName || "Patient",
      birthdate: claim.PatDOB ? claim.PatDOB.replace(/-/g, "") : "19850101",
      gender: claim.PatGender === 2 ? "F" : "M"
    },
    services: procs.results.map((p, idx) => ({
      lineNum: idx + 1,
      procedureCode: p.ProcCode,
      fee: p.FeeBilled || 0,
      toothNum: p.ToothNum || "",
      surface: p.Surf || ""
    }))
  });

  // Update claim status to 'S' (Sent)
  await c.env.DB.prepare(`UPDATE claim SET ClaimStatus = 'S' WHERE ClaimNum = ?`).bind(claimNum).run();

  return c.json({
    success: true,
    ClaimNum: claimNum,
    Edi837DContent: ediContent
  });
});

/**
 * POST /api/v1/claims/era835/post
 * Auto-posts ANSI X12 835 Remittance Advice (ERA) EOB payment to patient ledger.
 * Matches OpenDentBusiness/Eclaims/X835.cs.
 */
claimRoutes.post("/era835/post", async (c) => {
  const body = await c.req.json<{
    eraContent: string;
  }>();

  if (!body.eraContent) {
    return c.json({ error: "eraContent string is required" }, 400);
  }

  const parsed = parseX12_835(body.eraContent);

  // 1. Create ClaimPayment entry (Insurance Check/EFT)
  const payRes = await c.env.DB.prepare(
    `INSERT INTO claimpayment (CheckDate, CheckAmt, CheckNum, CarrierName, IsPartial)
     VALUES (?, ?, ?, ?, 0)`
  ).bind(
    parsed.paidDate,
    parsed.totalPaid,
    parsed.checkOrEftTrace || `EFT-${Date.now().toString().slice(-6)}`,
    parsed.payerName
  ).run();

  const claimPaymentNum = payRes.meta.last_row_id as number;
  const processedClaims: number[] = [];

  // 2. Adjudicate each claim in the ERA
  for (const item of parsed.claims) {
    // Verify claim exists
    const claim = await c.env.DB.prepare(
      `SELECT ClaimNum, PatNum, ClaimFee FROM claim WHERE ClaimNum = ?`
    ).bind(item.claimNum).first<{ ClaimNum: number; PatNum: number; ClaimFee: number }>();

    if (claim) {
      // Update claim to 'R' (Received) with paid amount
      await c.env.DB.prepare(
        `UPDATE claim SET ClaimStatus = 'R', InsPayAmt = ? WHERE ClaimNum = ?`
      ).bind(item.paidAmount, item.claimNum).run();

      // Update attached claimproc lines
      await c.env.DB.prepare(
        `UPDATE claimproc
         SET InsPayAmt = ?, WriteOff = ?, Status = 1, ClaimPaymentNum = ?
         WHERE ClaimNum = ?`
      ).bind(item.paidAmount, item.writeOff, claimPaymentNum, item.claimNum).run();

      // Record Etrans835 audit log
      await c.env.DB.prepare(
        `INSERT INTO etrans835 (ClaimNum, ClaimPaymentNum, PayerName, PayerID, CheckOrEFTTrace, CheckAmt, PaidDate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        item.claimNum,
        claimPaymentNum,
        parsed.payerName,
        parsed.payerId,
        parsed.checkOrEftTrace,
        item.paidAmount,
        parsed.paidDate
      ).run();

      // HIPAA Security Log
      await recordSecurityLog(c.env.DB, {
        PermType: 12, // InsPayCreate
        UserNum: 1,
        PatNum: claim.PatNum,
        FKey: item.claimNum,
        LogText: `ERA 835 Auto-Posted: $${item.paidAmount.toFixed(2)} paid by ${parsed.payerName}. WriteOff: $${item.writeOff.toFixed(2)}`
      });

      processedClaims.push(item.claimNum);
    }
  }

  return c.json({
    success: true,
    ClaimPaymentNum: claimPaymentNum,
    PayerName: parsed.payerName,
    TotalPaid: parsed.totalPaid,
    ClaimsAdjudicated: processedClaims
  }, 201);
});
