import { describe, it, expect } from "vitest";
import { computePaySplitSecurityHash } from "../src/routes/payments.js";

describe("Open Dental - Payments & PaySplit Ledger Subsystem", () => {
  it("computePaySplitSecurityHash_ProducesDeterministicSha256", async () => {
    const patNum = 1;
    const splitAmt = 250.0;
    const dateEntry = "2024-09-24T12:00:00.000Z";

    const hash1 = await computePaySplitSecurityHash(patNum, splitAmt, dateEntry);
    const hash2 = await computePaySplitSecurityHash(patNum, splitAmt, dateEntry);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string is 64 characters
  });

  it("computePaySplitSecurityHash_DetectsTamperedAmount", async () => {
    const patNum = 1;
    const dateEntry = "2024-09-24T12:00:00.000Z";

    const originalHash = await computePaySplitSecurityHash(patNum, 250.0, dateEntry);
    const tamperedHash = await computePaySplitSecurityHash(patNum, 250.01, dateEntry);

    expect(originalHash).not.toBe(tamperedHash);
  });

  it("PaySplit_AllocationLogic_DistributesPaymentAccurately", () => {
    // Simulates the automated split distribution algorithm:
    // Patient owes $150 on Proc 101, $300 on Proc 102. Patient pays $400.
    const procedures = [
      { ProcNum: 101, ProcFee: 150.0, PaidAmt: 0.0 },
      { ProcNum: 102, ProcFee: 300.0, PaidAmt: 0.0 }
    ];

    let paymentRemaining = 400.0;
    const splits: Array<{ ProcNum: number; SplitAmt: number; Unearned: boolean }> = [];

    for (const proc of procedures) {
      const balance = proc.ProcFee - proc.PaidAmt;
      if (balance > 0 && paymentRemaining > 0) {
        const split = Math.min(paymentRemaining, balance);
        splits.push({ ProcNum: proc.ProcNum, SplitAmt: split, Unearned: false });
        paymentRemaining -= split;
      }
    }

    if (paymentRemaining > 0) {
      splits.push({ ProcNum: 0, SplitAmt: paymentRemaining, Unearned: true });
    }

    // Proc 101 should receive $150
    expect(splits[0].ProcNum).toBe(101);
    expect(splits[0].SplitAmt).toBe(150.0);

    // Proc 102 should receive remaining $250
    expect(splits[1].ProcNum).toBe(102);
    expect(splits[1].SplitAmt).toBe(250.0);

    // Zero unearned remainder
    expect(paymentRemaining).toBe(0.0);
    expect(splits.length).toBe(2);
  });

  it("PaySplit_Overpayment_CreatesUnearnedPrepaymentSplit", () => {
    // Patient owes $100 on Proc 201, pays $175.
    const procedures = [
      { ProcNum: 201, ProcFee: 100.0, PaidAmt: 0.0 }
    ];

    let paymentRemaining = 175.0;
    const splits: Array<{ ProcNum: number; SplitAmt: number; Unearned: boolean }> = [];

    for (const proc of procedures) {
      const balance = proc.ProcFee - proc.PaidAmt;
      if (balance > 0 && paymentRemaining > 0) {
        const split = Math.min(paymentRemaining, balance);
        splits.push({ ProcNum: proc.ProcNum, SplitAmt: split, Unearned: false });
        paymentRemaining -= split;
      }
    }

    if (paymentRemaining > 0) {
      splits.push({ ProcNum: 0, SplitAmt: paymentRemaining, Unearned: true });
    }

    expect(splits[0].ProcNum).toBe(201);
    expect(splits[0].SplitAmt).toBe(100.0);
    expect(splits[1].ProcNum).toBe(0);
    expect(splits[1].SplitAmt).toBe(75.0);
    expect(splits[1].Unearned).toBe(true);
  });
});
