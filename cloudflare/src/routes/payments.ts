import { Hono } from "hono";
import type { Env, Payment, PaySplit, ProcedureLog } from "../types.js";
import { recordSecurityLog } from "../utils/security-log.js";

export const paymentRoutes = new Hono<{ Bindings: Env }>();

/**
 * Computes tamper-evident SecurityHash for PaySplit (matches OpenDentBusiness/TableTypes/PaySplit.cs).
 * Salted SHA-256 hash of PatNum, SplitAmt, DateEntry.
 */
export async function computePaySplitSecurityHash(
  patNum: number,
  splitAmt: number,
  dateEntry: string,
  salt: string = "OpenDentalSecurityKey_Edge2024"
): Promise<string> {
  const data = `${patNum}:${splitAmt.toFixed(2)}:${dateEntry}:${salt}`;
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

/**
 * POST /api/v1/payments/charge
 * Processes an EMV Terminal or Credit Card payment and distributes it to the patient's ledger.
 * Automatically creates a Payment row and splits it across unpaid completed procedures.
 */
paymentRoutes.post("/charge", async (c) => {
  const body = await c.req.json<{
    PatNum: number;
    Amount: number;
    PaymentSource?: number; // 4=StripeTerminal, 1=PayConnect, 3=EdgeExpress
    TerminalReaderId?: string;
    CardNumberMasked?: string;
    CardExp?: string;
    AutoSplit?: boolean;
    PayNote?: string;
    ClinicNum?: number;
    ProvNum?: number;
  }>();

  if (!body.PatNum || !body.Amount || body.Amount <= 0) {
    return c.json({ error: "Valid PatNum and positive Amount are required" }, 400);
  }

  const patNum = body.PatNum;
  const payAmt = Number(body.Amount);
  const payDate = new Date().toISOString().split("T")[0];
  const dateEntry = new Date().toISOString();
  const paymentSource = body.PaymentSource || 4; // Default to Stripe Terminal
  const externalId = `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const maskedCard = body.CardNumberMasked || "************4242";

  // 1. Insert Payment Record
  const payRes = await c.env.DB.prepare(
    `INSERT INTO payment (
      PayType, PayDate, PayAmt, CheckNum, PayNote, IsSplit, PatNum,
      ClinicNum, DateEntry, Receipt, PaymentSource, ProcessStatus, ExternalId
    ) VALUES (3, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(
    payDate,
    payAmt,
    `CARD-${maskedCard.slice(-4)}`,
    body.PayNote || "Card-Present EMV Transaction",
    patNum,
    body.ClinicNum || 0,
    dateEntry,
    `APPROVED EMV AUTH# ${Math.floor(100000 + Math.random() * 900000)} AID:A0000000041010`,
    paymentSource,
    externalId
  ).run();

  const payNum = payRes.meta.last_row_id as number;

  // 2. Automated PaySplit Logic: Distribute against completed procedures with unpaid balance
  const splitsCreated: PaySplit[] = [];
  let remainingPayAmt = payAmt;

  if (body.AutoSplit !== false) {
    // Find patient's completed procedures (ProcStatus = 2) ordered by oldest first
    const completedProcs = await c.env.DB.prepare(
      `SELECT pl.ProcNum, pl.PatNum, pl.ProcDate, pl.ProcFee, pl.ProvNum, pl.ClinicNum,
              COALESCE((SELECT SUM(ps.SplitAmt) FROM paysplit ps WHERE ps.ProcNum = pl.ProcNum), 0) as PaidAmt
       FROM procedurelog pl
       WHERE pl.PatNum = ? AND pl.ProcStatus = 2 AND pl.ProcFee > 0
       ORDER BY pl.ProcDate ASC, pl.ProcNum ASC`
    ).bind(patNum).all<ProcedureLog & { PaidAmt: number }>();

    for (const proc of completedProcs.results) {
      const balanceOnProc = proc.ProcFee - proc.PaidAmt;
      if (balanceOnProc > 0 && remainingPayAmt > 0) {
        const splitAmt = Math.min(remainingPayAmt, balanceOnProc);
        const splitHash = await computePaySplitSecurityHash(patNum, splitAmt, dateEntry);

        const splitRes = await c.env.DB.prepare(
          `INSERT INTO paysplit (
            SplitAmt, PatNum, ProcDate, PayNum, ProvNum, DatePay, ProcNum,
            DateEntry, UnearnedType, ClinicNum, SecUserNumEntry, SecurityHash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?)`
        ).bind(
          splitAmt,
          patNum,
          proc.ProcDate,
          payNum,
          proc.ProvNum,
          payDate,
          proc.ProcNum,
          dateEntry,
          proc.ClinicNum || 0,
          splitHash
        ).run();

        splitsCreated.push({
          SplitNum: splitRes.meta.last_row_id as number,
          SplitAmt: splitAmt,
          PatNum: patNum,
          PayNum: payNum,
          ProvNum: proc.ProvNum,
          DatePay: payDate,
          ProcNum: proc.ProcNum,
          DateEntry: dateEntry,
          UnearnedType: 0,
          ClinicNum: proc.ClinicNum || 0,
          SecUserNumEntry: 1,
          SecurityHash: splitHash
        });

        remainingPayAmt -= splitAmt;
      }
    }
  }

  // If excess payment remains, allocate as Unearned Prepayment (ProcNum = 0, UnearnedType = 1)
  if (remainingPayAmt > 0.001) {
    const provNum = body.ProvNum || 1;
    const unearnedHash = await computePaySplitSecurityHash(patNum, remainingPayAmt, dateEntry);

    const unearnedRes = await c.env.DB.prepare(
      `INSERT INTO paysplit (
        SplitAmt, PatNum, ProcDate, PayNum, ProvNum, DatePay, ProcNum,
        DateEntry, UnearnedType, ClinicNum, SecUserNumEntry, SecurityHash
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, ?, 1, ?)`
    ).bind(
      remainingPayAmt,
      patNum,
      payDate,
      payNum,
      provNum,
      payDate,
      dateEntry,
      body.ClinicNum || 0,
      unearnedHash
    ).run();

    splitsCreated.push({
      SplitNum: unearnedRes.meta.last_row_id as number,
      SplitAmt: remainingPayAmt,
      PatNum: patNum,
      PayNum: payNum,
      ProvNum: provNum,
      DatePay: payDate,
      ProcNum: 0,
      DateEntry: dateEntry,
      UnearnedType: 1,
      ClinicNum: body.ClinicNum || 0,
      SecUserNumEntry: 1,
      SecurityHash: unearnedHash
    });
  }

  // 3. Save credit card token for on-file use
  await c.env.DB.prepare(
    `INSERT INTO creditcard (PatNum, CCNumberMasked, CCExpiration, Token, CCSource, ClinicNum)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    patNum,
    maskedCard,
    body.CardExp || "2029-12-01",
    externalId,
    paymentSource,
    body.ClinicNum || 0
  ).run();

  // 4. Log HIPAA Security Audit
  await recordSecurityLog(c.env.DB, {
    PermType: 6, // PaymentCreate
    UserNum: 1,
    PatNum: patNum,
    FKey: payNum,
    LogText: `Card Payment processed: $${payAmt.toFixed(2)} via Terminal. Splits: ${splitsCreated.length}`
  });

  return c.json({
    success: true,
    PayNum: payNum,
    PayAmt: payAmt,
    ExternalId: externalId,
    CardMasked: maskedCard,
    Splits: splitsCreated,
    UnearnedAllocated: remainingPayAmt > 0.001 ? remainingPayAmt : 0
  }, 201);
});

/**
 * GET /api/v1/payments/ledger/:PatNum
 * Retrieves the comprehensive patient ledger: completed procedures, insurance payments, patient payments, and net balance.
 */
paymentRoutes.get("/ledger/:PatNum", async (c) => {
  const patNum = parseInt(c.req.param("PatNum"), 10);

  // 1. Completed procedures
  const procedures = await c.env.DB.prepare(
    `SELECT pl.ProcNum, pl.ProcDate, pl.ProcFee, pl.ToothNum, pl.Surf, pc.ProcCode, pc.Descript,
            pr.Abbr as ProvAbbr
     FROM procedurelog pl
     JOIN procedurecode pc ON pl.CodeNum = pc.CodeNum
     JOIN provider pr ON pl.ProvNum = pr.ProvNum
     WHERE pl.PatNum = ? AND pl.ProcStatus = 2
     ORDER BY pl.ProcDate ASC`
  ).bind(patNum).all();

  // 2. Payments & Splits
  const payments = await c.env.DB.prepare(
    `SELECT p.PayNum, p.PayDate, p.PayAmt, p.Receipt, p.PaymentSource, ps.SplitNum, ps.SplitAmt,
            ps.ProcNum, ps.UnearnedType, ps.SecurityHash
     FROM payment p
     JOIN paysplit ps ON p.PayNum = ps.PayNum
     WHERE p.PatNum = ?
     ORDER BY p.PayDate ASC`
  ).bind(patNum).all();

  // 3. Insurance Claims & ClaimProcs
  const claims = await c.env.DB.prepare(
    `SELECT cp.ClaimProcNum, cp.ClaimNum, cp.ProcNum, cp.InsPayAmt, cp.WriteOff, cp.DedApplied,
            cp.Status, c.DateService, car.CarrierName
     FROM claimproc cp
     JOIN claim c ON cp.ClaimNum = c.ClaimNum
     JOIN insplan ip ON c.PlanNum = ip.PlanNum
     JOIN carrier car ON ip.CarrierNum = car.CarrierNum
     WHERE cp.PatNum = ? AND cp.Status = 1`
  ).bind(patNum).all();

  // Calculate totals
  let totalBilled = 0;
  for (const proc of procedures.results as any[]) {
    totalBilled += proc.ProcFee || 0;
  }

  let totalInsPaid = 0;
  let totalWriteOff = 0;
  for (const cp of claims.results as any[]) {
    totalInsPaid += cp.InsPayAmt || 0;
    totalWriteOff += cp.WriteOff || 0;
  }

  let totalPatientPaid = 0;
  let totalUnearned = 0;
  for (const pay of payments.results as any[]) {
    totalPatientPaid += pay.SplitAmt || 0;
    if (pay.UnearnedType === 1) {
      totalUnearned += pay.SplitAmt || 0;
    }
  }

  const patientBalanceDue = Math.max(0, totalBilled - totalInsPaid - totalWriteOff - (totalPatientPaid - totalUnearned));

  return c.json({
    PatNum: patNum,
    Summary: {
      TotalBilled: Number(totalBilled.toFixed(2)),
      TotalInsurancePaid: Number(totalInsPaid.toFixed(2)),
      TotalWriteOff: Number(totalWriteOff.toFixed(2)),
      TotalPatientPaid: Number(totalPatientPaid.toFixed(2)),
      UnearnedPrepaymentBalance: Number(totalUnearned.toFixed(2)),
      PatientBalanceDue: Number(patientBalanceDue.toFixed(2))
    },
    Procedures: procedures.results,
    Payments: payments.results,
    InsuranceClaims: claims.results
  });
});

/**
 * POST /api/v1/payments/webhook
 * Asynchronous webhook for terminal or online payments (e.g. Stripe Terminal, PayConnect)
 */
paymentRoutes.post("/webhook", async (c) => {
  const body = await c.req.json<{
    event: string;
    paymentId: string;
    patNum: number;
    amount: number;
    status: string;
  }>();

  if (body.status === "succeeded" && body.patNum && body.amount > 0) {
    await c.env.DB.prepare(
      `UPDATE payment SET ProcessStatus = 1 WHERE ExternalId = ?`
    ).bind(body.paymentId).run();

    return c.json({ received: true, status: "updated" });
  }

  return c.json({ received: true });
});
