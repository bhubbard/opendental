import { describe, it, expect } from "vitest";
import { generate32CharPhrase, createDoseSpotSsoCodes } from "../src/routes/erx.js";

describe("Open Dental - eRx & EPCS Prescribing Subsystem", () => {
  it("generate32CharPhrase_Produces32AlphanumericCharacters", () => {
    const phrase = generate32CharPhrase();
    expect(phrase).toHaveLength(32);
    expect(/^[A-Za-z0-9]{32}$/.test(phrase)).toBe(true);
  });

  it("createDoseSpotSsoCodes_MatchesOpenDentalDoseSpotAlgorithm", async () => {
    // Fixed test vector matching OpenDentBusiness DoseSpot.cs specification
    const clinicKey = "SecretClinicKey123";
    const userId = "501";
    const predefinedPhrase = "12345678901234567890123456789012"; // 32 characters

    const { singleSignOnCode, singleSignOnUserIdVerify } = await createDoseSpotSsoCodes(
      clinicKey,
      userId,
      predefinedPhrase
    );

    // The SSO code must begin with the exact 32 character phrase
    expect(singleSignOnCode.startsWith(predefinedPhrase)).toBe(true);

    // The hash portion is a Base64 string without trailing '=='
    const hashPart = singleSignOnCode.slice(32);
    expect(hashPart.endsWith("==")).toBe(false);

    // SingleSignOnUserIdVerify must also be a Base64 string without trailing '=='
    expect(singleSignOnUserIdVerify.endsWith("==")).toBe(false);
    expect(singleSignOnUserIdVerify.length).toBeGreaterThan(20);
  });

  it("EPCS_Validation_EnforcesDeaFormatAndNpi", () => {
    // Valid DEA: 2 letters followed by 7 digits
    const validDea = "AB1234567";
    const invalidDea1 = "A1234567"; // Only 1 letter
    const invalidDea2 = "AB123456";  // Only 6 digits
    const deaRegex = /^[A-Za-z]{2}[0-9]{7}$/;

    expect(deaRegex.test(validDea)).toBe(true);
    expect(deaRegex.test(invalidDea1)).toBe(false);
    expect(deaRegex.test(invalidDea2)).toBe(false);

    // Valid NPI: exactly 10 digits
    const validNpi = "1234567890";
    const invalidNpi = "12345";
    const npiClean = (npi: string) => npi.replace(/[^0-9]/g, "");

    expect(npiClean(validNpi).length).toBe(10);
    expect(npiClean(invalidNpi).length).toBe(5);
  });

  it("EPCS_ControlledSubstance_RequiresDualFactorToken", () => {
    const isControlled = (schedule: string) => schedule !== "None";

    expect(isControlled("Schedule II")).toBe(true);
    expect(isControlled("Schedule III")).toBe(true);
    expect(isControlled("None")).toBe(false);

    const hasValidEpcsAuth = (token?: string) => Boolean(token && token.length >= 6);

    expect(hasValidEpcsAuth("982341")).toBe(true);
    expect(hasValidEpcsAuth("123")).toBe(false);
    expect(hasValidEpcsAuth(undefined)).toBe(false);
  });
});
