export interface DentalClaimInput {
  claimId: number;
  dateOfService: string;
  totalFee: number;
  billingProvider: {
    npi: string;
    taxId: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  subscriber: {
    memberId: string;
    lastName: string;
    firstName: string;
    birthdate: string;
    gender: "M" | "F";
  };
  carrierPayerId: string;
  services: Array<{
    lineNum: number;
    procedureCode: string; // e.g. D2740
    fee: number;
    toothNum?: string;
    surface?: string;
  }>;
}

/**
 * Generates standard ANSI ASC X12 837D (Health Care Claim: Dental) file format.
 */
export function generateEDI837D(input: DentalClaimInput): string {
  const segments: string[] = [];

  // ISA - Interchange Control Header
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const timeStr = new Date().toISOString().slice(11, 16).replace(/:/g, "");
  segments.push(`ISA*00*          *00*          *ZZ*SUBMITTER      *ZZ*${input.carrierPayerId.padEnd(15, " ")}*${dateStr}*${timeStr}*^*00501*000000001*0*P*:~`);

  // GS - Functional Group Header
  segments.push(`GS*HC*SUBMITTER*${input.carrierPayerId}*${dateStr}*${timeStr}*1*X*005010X224A2~`);

  // ST - Transaction Set Header (837 Dental)
  segments.push(`ST*837*0001*005010X224A2~`);
  segments.push(`BHT*0010*00*CLAIM-${input.claimId}*${dateStr}*${timeStr}*CH~`);

  // 1000A Submitter Name
  segments.push(`NM1*41*2*OPENDENTAL CLOUD*****46*SUBMITTERID~`);
  segments.push(`PER*IC*EDI DEPT*TE*8005550199~`);

  // 1000B Receiver Name
  segments.push(`NM1*40*2*PAYER NAME*****46*${input.carrierPayerId}~`);

  // 2000A Billing Provider Hierarchical Level
  segments.push(`HL*1**20*1~`);
  segments.push(`NM1*85*1*${input.billingProvider.name}*****XX*${input.billingProvider.npi}~`);
  segments.push(`N3*${input.billingProvider.address}~`);
  segments.push(`N4*${input.billingProvider.city}*${input.billingProvider.state}*${input.billingProvider.zip}~`);

  // 2000B Subscriber Hierarchical Level
  segments.push(`HL*2*1*22*0~`);
  segments.push(`SBR*P*18*******CI~`);
  segments.push(`NM1*IL*1*${input.subscriber.lastName}*${input.subscriber.firstName}****MI*${input.subscriber.memberId}~`);
  segments.push(`DMG*D8*${input.subscriber.birthdate.replace(/-/g, "")}*${input.subscriber.gender}~`);

  // 2300 Claim Information
  segments.push(`CLM*CLAIM-${input.claimId}*${input.totalFee.toFixed(2)}***12:B:1*Y*A*Y*Y~`);
  segments.push(`DTP*472*D8*${input.dateOfService.replace(/-/g, "")}~`);

  // 2400 Service Lines
  for (const s of input.services) {
    segments.push(`LX*${s.lineNum}~`);
    segments.push(`SV3*AD:${s.procedureCode}*${s.fee.toFixed(2)}**${s.toothNum || ""}**1~`);
    if (s.surface) {
      segments.push(`TOO*JP*${s.toothNum}*${s.surface}~`);
    }
  }

  // SE - Transaction Set Trailer
  segments.push(`SE*${segments.length - 2}*0001~`);
  segments.push(`GE*1*1~`);
  segments.push(`IEA*1*000000001~`);

  return segments.join("\n");
}
