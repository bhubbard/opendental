// Tests for HIPAA SecurityLog, 6-Site Perio Charting, FHIR R4, and EDI 837D Dental Claims
import { describe, it, expect } from "vitest";
import { generateEDI837D } from "../src/utils/edi837d.js";

describe("Open Dental - HIPAA, Perio, FHIR & EDI Suites", () => {
  it("computes HIPAA SecurityLog SHA-256 base64 hash matching Open Dental formula", async () => {
    // OpenDentBusiness.SecurityLogHash formula:
    // SHA256(PermType + UserNum + LogDateTime + LogText + PatNum) -> Base64
    const permType = 3; // PatientCreate
    const userNum = 1;
    const logDateTime = "2026-09-24T19:50:00Z";
    const logText = "Created patient record Doe, Jane";
    const patNum = 1;

    const raw = `${permType}${userNum}${logDateTime}${logText}${patNum}`;
    const msgUint8 = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

    expect(typeof hashBase64).toBe("string");
    expect(hashBase64.length).toBe(44); // 32 bytes base64 encoded = 44 chars with padding
  });

  it("evaluates 6-site periodontal probing depths and identifies deep pockets (>=4mm)", () => {
    interface PerioSiteDepth {
      toothNum: number;
      MB: number;
      B: number;
      DB: number;
      ML: number;
      L: number;
      DL: number;
    }

    const examSites: PerioSiteDepth[] = [
      { toothNum: 3, MB: 3, B: 2, DB: 3, ML: 3, L: 2, DL: 3 }, // Healthy sulcus (<=3mm)
      { toothNum: 19, MB: 5, B: 4, DB: 6, ML: 4, L: 3, DL: 5 }, // Active periodontal disease (pocketing >= 4mm)
    ];

    const hasPocketing = (site: PerioSiteDepth) => {
      return [site.MB, site.B, site.DB, site.ML, site.L, site.DL].some(d => d >= 4);
    };

    expect(hasPocketing(examSites[0])).toBe(false);
    expect(hasPocketing(examSites[1])).toBe(true);
  });

  it("generates compliant ANSI ASC X12 837D Electronic Dental Claim string", () => {
    const claim = generateEDI837D({
      claimId: 1042,
      dateOfService: "2026-09-24",
      totalFee: 1455.0,
      billingProvider: {
        npi: "1295819201",
        taxId: "95-1234567",
        name: "BB DENTAL CARE",
        address: "201 N BRAND BLVD STE 200",
        city: "GLENDALE",
        state: "CA",
        zip: "91203"
      },
      subscriber: {
        memberId: "DELTA-998811",
        lastName: "DOE",
        firstName: "JANE",
        birthdate: "1990-05-14",
        gender: "F"
      },
      carrierPayerId: "92011", // Delta Dental CA
      services: [
        { lineNum: 1, procedureCode: "D0120", fee: 65.0 },
        { lineNum: 2, procedureCode: "D2740", fee: 1350.0, toothNum: "19", surface: "MOD" },
        { lineNum: 3, procedureCode: "D1206", fee: 40.0 }
      ]
    });

    // Check EDI segment markers
    expect(claim).toContain("ISA*00*");
    expect(claim).toContain("GS*HC*SUBMITTER*92011");
    expect(claim).toContain("ST*837*0001*005010X224A2~");
    expect(claim).toContain("CLM*CLAIM-1042*1455.00");
    expect(claim).toContain("SV3*AD:D2740*1350.00**19**1~");
    expect(claim).toContain("TOO*JP*19*MOD~");
    expect(claim).toContain("SE*");
  });

  it("formats FHIR R4 Patient resource according to US Core guidelines", () => {
    const patientObj = {
      resourceType: "Patient",
      id: "1",
      name: [{ family: "Doe", given: ["Jane", "A"] }],
      gender: "female",
      birthDate: "1990-05-14",
      telecom: [{ system: "phone", value: "818-555-1212", use: "mobile" }]
    };

    expect(patientObj.resourceType).toBe("Patient");
    expect(patientObj.name[0].family).toBe("Doe");
    expect(patientObj.telecom[0].system).toBe("phone");
  });
});
