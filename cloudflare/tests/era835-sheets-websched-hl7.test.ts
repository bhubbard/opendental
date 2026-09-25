import { describe, it, expect } from "vitest";
import { parseX12_835 } from "../src/routes/claims.js";
import { parseHL7Message, buildHL7Ack } from "../src/routes/hl7.js";

describe("Open Dental - Advanced Subsystems (ERA 835 & HL7 v2)", () => {
  it("parseX12_835_ExtractsPaymentAndClaimLinesAccurately", () => {
    const raw835 = [
      "ISA*00*          *00*          *ZZ*SUBMITTER      *ZZ*RECEIVER       *240924*1200*^*00501*000000001*0*P*:~",
      "GS*HP*SUBMITTER*RECEIVER*20240924*1200*1*X*005010X221A1~",
      "ST*835*0001~",
      "BPR*I*1250.00*C*ACH*CTX*01*999999999*DA*12345678*1999999999**01*999999999*DA*87654321*20240924~",
      "TRN*1*EFT987654321*1999999999~",
      "N1*PR*Delta Dental of California*XX*92011~",
      "CLP*101*1*500.00*400.00*50.00*12*CLM101~",
      "CLP*102*1*850.00*850.00*0.00*12*CLM102~",
      "SE*8*0001~",
      "GE*1*1~",
      "IEA*1*000000001~"
    ].join("\r\n");

    const parsed = parseX12_835(raw835);

    expect(parsed.totalPaid).toBe(1250.00);
    expect(parsed.payerName).toBe("Delta Dental of California");
    expect(parsed.checkOrEftTrace).toBe("EFT987654321");
    expect(parsed.claims.length).toBe(2);

    // Claim 101
    expect(parsed.claims[0].claimNum).toBe(101);
    expect(parsed.claims[0].totalCharge).toBe(500.00);
    expect(parsed.claims[0].paidAmount).toBe(400.00);
    expect(parsed.claims[0].patientResponsibility).toBe(50.00);
    expect(parsed.claims[0].writeOff).toBe(50.00); // 500 - 400 - 50 = 50

    // Claim 102
    expect(parsed.claims[1].claimNum).toBe(102);
    expect(parsed.claims[1].paidAmount).toBe(850.00);
    expect(parsed.claims[1].writeOff).toBe(0.00);
  });

  it("parseHL7Message_ParsesAdtDemographicsAndGeneratesAck", () => {
    const rawHL7 = [
      "MSH|^~\\&|HOSPITAL_EMR|MAIN_CAMPUS|OPENDENTAL|CLINIC_1|20240924103000||ADT^A08|MSG_77812|P|2.3",
      "EVN|A08|20240924103000",
      "PID|1||90210^^^OD||WILLIAMS^ALICE^M||19900820|F|||742 EVERGREEN TERRACE^^SPRINGFIELD^OR^97477||555-4321",
      "PV1|1|O|CLINIC^^1"
    ].join("\r\n");

    const parsed = parseHL7Message(rawHL7);

    expect(parsed.msgType).toBe("ADT^A08");
    expect(parsed.controlId).toBe("MSG_77812");
    expect(parsed.patient.patNum).toBe(90210);
    expect(parsed.patient.lastName).toBe("WILLIAMS");
    expect(parsed.patient.firstName).toBe("ALICE");
    expect(parsed.patient.dob).toBe("1990-08-20");
    expect(parsed.patient.gender).toBe(2); // Female = 2

    // Check standard ACK response
    const ack = buildHL7Ack(parsed.controlId, "AA", "Patient demographic updated");
    expect(ack).toContain("MSA|AA|MSG_77812");
    expect(ack).toContain("ACK|MSG_77812");
  });
});
