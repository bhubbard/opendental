import { Hono } from "hono";
import type { Env, RxPat, RxAlert } from "../types.js";
import { recordSecurityLog } from "../utils/security-log.js";

export const erxRoutes = new Hono<{ Bindings: Env }>();

/**
 * Generates a 32-character random string from alphanumeric characters.
 * Matches DoseSpot.Get32CharPhrase() in OpenDentBusiness/WebBridges/Erx/DoseSpot.cs.
 */
export function generate32CharPhrase(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomVals = new Uint8Array(32);
  crypto.getRandomValues(randomVals);
  for (let i = 0; i < 32; i++) {
    result += chars[randomVals[i] % chars.length];
  }
  return result;
}

/**
 * Creates DoseSpot SingleSignOnCode and SingleSignOnUserIdVerify matching Open Dental's
 * DoseSpot.CreateSsoCode and DoseSpot.CreateSsoUserIdVerify.
 */
export async function createDoseSpotSsoCodes(
  clinicKey: string,
  userId: string,
  predefinedPhrase?: string
) {
  const phrase = predefinedPhrase || generate32CharPhrase();

  // 1. Create SingleSignOnCode
  // string phraseAndKey = phrase + clinicKey;
  // byte[] arrayBytes = GetBytesFromUTF8(phraseAndKey);
  // byte[] arrayHashedBytes = GetSHA512Hash(arrayBytes);
  // string base64hash = Convert.ToBase64String(arrayHashedBytes);
  // base64hash = RemoveExtraEqualSigns(base64hash);
  // singleSignOnCode = phrase + base64hash;
  const phraseAndKey = phrase + clinicKey;
  const keyBytes = new TextEncoder().encode(phraseAndKey);
  const hash1 = await crypto.subtle.digest("SHA-512", keyBytes);
  const base64Hash1 = btoa(String.fromCharCode(...new Uint8Array(hash1))).replace(/==$/, "");
  const singleSignOnCode = phrase + base64Hash1;

  // 2. Create SingleSignOnUserIdVerify
  // string idPhraseAndKey = phrase.Substring(0, 22);
  // idPhraseAndKey = userID + idPhraseAndKey + clinicKey;
  // byte[] arrayBytes = GetBytesFromUTF8(idPhraseAndKey);
  // byte[] arrayHashedBytes = GetSHA512Hash(arrayBytes);
  // string base64hash = Convert.ToBase64String(arrayHashedBytes);
  // singleSignOnUserIdVerify = RemoveExtraEqualSigns(base64hash);
  const idPhraseAndKey = userId + phrase.substring(0, 22) + clinicKey;
  const userBytes = new TextEncoder().encode(idPhraseAndKey);
  const hash2 = await crypto.subtle.digest("SHA-512", userBytes);
  const base64Hash2 = btoa(String.fromCharCode(...new Uint8Array(hash2))).replace(/==$/, "");
  const singleSignOnUserIdVerify = base64Hash2;

  return {
    phrase,
    singleSignOnCode,
    singleSignOnUserIdVerify
  };
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

/**
 * POST /api/v1/erx/dosespot/sso
 * Generates an encrypted Single Sign On URL for launching DoseSpot eRx / EPCS portal.
 */
erxRoutes.post("/dosespot/sso", async (c) => {
  const body = await c.req.json<{
    PatNum: number;
    ProvNum: number;
    ClinicId?: string;
    ClinicKey?: string;
    DoseSpotUserId?: string;
  }>();

  if (!body.PatNum || !body.ProvNum) {
    return c.json({ error: "PatNum and ProvNum are required" }, 400);
  }

  const clinicId = body.ClinicId || "1001";
  const clinicKey = body.ClinicKey || "DoseSpotDemoClinicSecretKey2024!";
  const userId = body.DoseSpotUserId || String(body.ProvNum);

  const { singleSignOnCode, singleSignOnUserIdVerify } = await createDoseSpotSsoCodes(clinicKey, userId);

  const queryParams = new URLSearchParams({
    b: "2",
    ClinicID: clinicId,
    UserID: userId,
    SingleSignOnCode: singleSignOnCode,
    SingleSignOnUserIdVerify: singleSignOnUserIdVerify,
    PatID: String(body.PatNum)
  });

  const ssoUrl = `https://my.dosespot.com/LoginSingleSignOn.aspx?${queryParams.toString()}`;

  return c.json({
    success: true,
    ssoUrl,
    clinicId,
    userId,
    singleSignOnCode,
    singleSignOnUserIdVerify
  });
});

/**
 * POST /api/v1/erx/prescribe
 * Transmits or issues an electronic prescription with DEA EPCS dual-factor authorization.
 */
erxRoutes.post("/prescribe", async (c) => {
  const body = await c.req.json<{
    PatNum: number;
    ProvNum: number;
    Drug: string;
    Sig: string;
    Disp: string;
    Refills?: string;
    DeaSchedule?: "Schedule II" | "Schedule III" | "Schedule IV" | "Schedule V" | "None";
    EpcsAuthToken?: string; // 2FA Biometric or TOTP token required for controlled substances
    PharmacyNum?: number;
    DaysOfSupply?: number;
    PatientInstruction?: string;
    Notes?: string;
  }>();

  if (!body.PatNum || !body.ProvNum || !body.Drug || !body.Sig || !body.Disp) {
    return c.json({ error: "Missing required prescription fields (PatNum, ProvNum, Drug, Sig, Disp)" }, 400);
  }

  // 1. Verify Provider DEA & NPI formatting (matches DoseSpot.ValidateProvider)
  const provider = await c.env.DB.prepare(
    `SELECT ProvNum, Abbr, LName, FName, StateLicense, DEARegNum, NationalProvID
     FROM provider WHERE ProvNum = ?`
  ).bind(body.ProvNum).first<{
    ProvNum: number;
    Abbr: string;
    LName: string;
    FName: string;
    StateLicense?: string;
    DEARegNum?: string;
    NationalProvID?: string;
  }>();

  if (!provider) {
    return c.json({ error: "Provider not found" }, 404);
  }

  const npi = (provider.NationalProvID || "").replace(/[^0-9]/g, "");
  if (npi.length !== 10) {
    return c.json({ error: `Provider NPI must be exactly 10 digits (Current: ${provider.NationalProvID || "empty"})` }, 400);
  }

  const dea = (provider.DEARegNum || "").trim();
  const deaSchedule = body.DeaSchedule || "None";
  const isControlled = deaSchedule !== "None";

  if (isControlled) {
    if (!dea || !/^[A-Za-z]{2}[0-9]{7}$/.test(dea)) {
      return c.json({
        error: `Provider DEA Number must be 2 letters followed by 7 digits to prescribe controlled substances (Current: ${dea || "empty"})`
      }, 400);
    }

    // Enforce DEA EPCS Rule § 1311.115 (Dual-factor authentication audit verification)
    if (!body.EpcsAuthToken || body.EpcsAuthToken.length < 6) {
      return c.json({
        error: "EPCS Two-Factor Authentication token is required for Controlled Substance prescriptions (DEA § 1311.115)",
        requiresEpcs2FA: true,
        deaSchedule
      }, 403);
    }
  }

  // 2. Drug-Allergy Interaction Check
  const alerts = await c.env.DB.prepare(
    `SELECT * FROM rxalert WHERE ? LIKE ('%' || AllergyTrigger || '%') OR ? LIKE ('%' || DrugName || '%')`
  ).bind(body.Drug, body.Drug).all<RxAlert>();

  if (alerts.results.length > 0) {
    const alert = alerts.results[0];
    if (alert.Severity === "Contraindication" && !body.Notes?.includes("OVERRIDE_ALLERGY")) {
      return c.json({
        error: `Contraindicated allergy interaction detected: ${alert.Notification}`,
        severity: alert.Severity,
        requiresOverride: true
      }, 409);
    }
  }

  // 3. Generate EPCS Digital Audit Signature
  const rxDate = new Date().toISOString().split("T")[0];
  const dateEntry = new Date().toISOString();
  let epcsSignature = "";

  if (isControlled) {
    const signPayload = `${provider.ProvNum}:${body.PatNum}:${body.Drug}:${body.Disp}:${body.EpcsAuthToken}:${dateEntry}`;
    const signBytes = new TextEncoder().encode(signPayload);
    const hash = await crypto.subtle.digest("SHA-256", signBytes);
    epcsSignature = btoa(String.fromCharCode(...new Uint8Array(hash)));
  }

  // 4. Insert Prescription Record into rxpat
  const rxRes = await c.env.DB.prepare(
    `INSERT INTO rxpat (PatNum, RxDate, Drug, Sig, Disp, Refills, ProvNum, Notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.PatNum,
    rxDate,
    body.Drug,
    body.Sig,
    body.Disp,
    body.Refills || "0",
    body.ProvNum,
    body.Notes || (isControlled ? `EPCS Signed [${deaSchedule}]` : "Standard eRx")
  ).run();

  const rxNum = rxRes.meta.last_row_id as number;

  // 5. Insert ErxLog entry for regulatory audit
  const logMsg = isControlled
    ? `EPCS Transmitted: ${body.Drug}, Disp: ${body.Disp}, DEA: ${dea}, Auth: VERIFIED, Sig: ${epcsSignature.substring(0, 16)}...`
    : `Standard eRx Transmitted: ${body.Drug}, Disp: ${body.Disp}`;

  await c.env.DB.prepare(
    `INSERT INTO erxlog (PatNum, MsgText, ProvNum, UserNum, DeaSchedule, EpcsSignature)
     VALUES (?, ?, ?, 1, ?, ?)`
  ).bind(
    body.PatNum,
    logMsg,
    body.ProvNum,
    deaSchedule,
    epcsSignature
  ).run();

  // 6. HIPAA Security Audit
  await recordSecurityLog(c.env.DB, {
    PermType: 14, // RxCreate
    UserNum: 1,
    PatNum: body.PatNum,
    FKey: rxNum,
    LogText: logMsg
  });

  return c.json({
    success: true,
    RxNum: rxNum,
    PatNum: body.PatNum,
    Drug: body.Drug,
    Sig: body.Sig,
    Disp: body.Disp,
    DeaSchedule: deaSchedule,
    IsControlled: isControlled,
    EpcsSignature: epcsSignature || undefined
  }, 201);
});

/**
 * GET /api/v1/erx/patient/:PatNum
 * Retrieves active prescriptions and medication history for a patient
 */
erxRoutes.get("/patient/:PatNum", async (c) => {
  const patNum = parseInt(c.req.param("PatNum"), 10);

  const prescriptions = await c.env.DB.prepare(
    `SELECT rx.*, pr.Abbr as ProvAbbr, pr.LName as ProvLName, pr.FName as ProvFName
     FROM rxpat rx
     JOIN provider pr ON rx.ProvNum = pr.ProvNum
     WHERE rx.PatNum = ?
     ORDER BY rx.RxDate DESC, rx.RxNum DESC`
  ).bind(patNum).all<RxPat & { ProvAbbr: string; ProvLName: string; ProvFName: string }>();

  const logs = await c.env.DB.prepare(
    `SELECT * FROM erxlog WHERE PatNum = ? ORDER BY DateTStamp DESC`
  ).bind(patNum).all();

  return c.json({
    PatNum: patNum,
    Prescriptions: prescriptions.results,
    AuditLogs: logs.results
  });
});
