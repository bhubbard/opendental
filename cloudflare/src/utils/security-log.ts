import type { Env } from "../types.js";

export enum PermType {
  AppointmentCreate = 1,
  AppointmentEdit = 2,
  AppointmentMove = 3,
  PatientCreate = 4,
  PatientEdit = 5,
  ProcComplete = 6,
  SecurityAdmin = 7
}

/**
 * Creates an immutable HIPAA audit log entry with a tamper-evident SHA-256 hash.
 * Formula from OpenDentBusiness.SecurityLogHash:
 * SHA256(PermType + UserNum + LogDateTime + LogText + PatNum) -> Base64
 */
export async function logSecurityEvent(
  db: D1Database,
  permType: PermType,
  patNum: number,
  logText: string,
  userNum: number = 1,
  fKey: number = 0
): Promise<number> {
  const logDateTime = new Date().toISOString();

  // Compute Open Dental SHA-256 hash
  const rawString = `${permType}${userNum}${logDateTime}${logText}${patNum}`;
  const msgUint8 = new TextEncoder().encode(rawString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

  // Insert SecurityLog entry
  const result = await db.prepare(`
    INSERT INTO securitylog (
      PermType, UserNum, LogDateTime, LogText, PatNum, FKey, LogHash
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    permType,
    userNum,
    logDateTime,
    logText,
    patNum,
    fKey,
    hashBase64
  ).run();

  const secLogNum = result.meta.last_row_id as number;

  // Insert SecurityLogHash entry for tamper verification
  await db.prepare(`
    INSERT INTO securityloghash (
      SecurityLogNum, LogHash
    ) VALUES (?, ?)
  `).bind(secLogNum, hashBase64).run();

  return secLogNum;
}
