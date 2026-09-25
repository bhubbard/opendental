// Port of Open Dental ProcedureLogicTests.cs and ProceduresTests.cs
// Source: UnitTests/UnitTests/ProcedureLogicTests.cs
import { describe, it, expect } from "vitest";

describe("Open Dental - ProcedureLogicTests (matching ProcedureLogicTests.cs)", () => {
  // Tooth classification helpers matching OpenDentBusiness.Tooth
  function isAnteriorTooth(toothNumStr: string): boolean {
    const num = Number(toothNumStr);
    if (isNaN(num)) {
      // Primary anterior: C, D, E, F, G, H and M, N, O, P, Q, R
      return ["C", "D", "E", "F", "G", "H", "M", "N", "O", "P", "Q", "R"].includes(toothNumStr.toUpperCase());
    }
    // Permanent anterior: 6-11 (maxillary) and 22-27 (mandibular)
    return (num >= 6 && num <= 11) || (num >= 22 && num <= 27);
  }

  function validateToothSurfaces(toothNumStr: string, surf: string): { valid: boolean; error?: string } {
    const cleanSurf = surf.toUpperCase().trim();
    if (!cleanSurf) return { valid: true };

    const anterior = isAnteriorTooth(toothNumStr);
    const allowedAnterior = new Set(["M", "I", "D", "B", "F", "L", "V"]); // Facial/Buccal, Incisal, Lingual
    const allowedPosterior = new Set(["M", "O", "D", "B", "L", "F", "V"]); // Occlusal, Buccal, Lingual

    const allowed = anterior ? allowedAnterior : allowedPosterior;

    for (const char of cleanSurf) {
      if (!allowed.has(char)) {
        return {
          valid: false,
          error: `Surface '${char}' is invalid for ${anterior ? 'anterior' : 'posterior'} tooth #${toothNumStr}`
        };
      }
    }

    return { valid: true };
  }

  // Canonical surface order sorting matching OpenDentBusiness.ToothLogic.SurfaceSort
  function sortSurfaces(surf: string, isAnterior: boolean): string {
    const orderAnterior = ["M", "I", "D", "F", "B", "L"];
    const orderPosterior = ["M", "O", "D", "B", "F", "L"];
    const order = isAnterior ? orderAnterior : orderPosterior;

    const chars = Array.from(new Set(surf.toUpperCase().split("")));
    chars.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return chars.join("");
  }

  it("ProcedureLogic_Validates_Tooth_Surfaces_Posterior", () => {
    // Tooth #19 is a lower left molar (posterior)
    expect(validateToothSurfaces("19", "MOD").valid).toBe(true);
    expect(validateToothSurfaces("19", "O").valid).toBe(true);
    expect(validateToothSurfaces("19", "MODBL").valid).toBe(true);

    // 'I' (Incisal) is invalid on a posterior molar!
    const invalid = validateToothSurfaces("19", "MID");
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toContain("Surface 'I' is invalid for posterior tooth #19");
  });

  it("ProcedureLogic_Validates_Tooth_Surfaces_Anterior", () => {
    // Tooth #8 is a central incisor (anterior)
    expect(validateToothSurfaces("8", "MID").valid).toBe(true);
    expect(validateToothSurfaces("8", "MF").valid).toBe(true);
    expect(validateToothSurfaces("8", "ML").valid).toBe(true);

    // 'O' (Occlusal) is invalid on an anterior incisor!
    const invalid = validateToothSurfaces("8", "MOD");
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toContain("Surface 'O' is invalid for anterior tooth #8");
  });

  it("ProcedureLogic_SortSurfaces_In_Standard_Dental_Order", () => {
    // Posterior standard order: M, O, D, B, L
    expect(sortSurfaces("DOM", false)).toBe("MOD");
    expect(sortSurfaces("LBD", false)).toBe("DBL");

    // Anterior standard order: M, I, D, F, L
    expect(sortSurfaces("DIM", true)).toBe("MID");
  });

  it("ProcedureLogic_Validates_Universal_Tooth_Numbering", () => {
    const isValidToothNumber = (tooth: string) => {
      const num = Number(tooth);
      if (!isNaN(num)) {
        return (num >= 1 && num <= 32) || (num >= 51 && num <= 82); // Adult or supernumerary
      }
      return /^[A-T]$/i.test(tooth) || /^[A-T]S$/i.test(tooth); // Primary or primary supernumerary
    };

    expect(isValidToothNumber("1")).toBe(true);
    expect(isValidToothNumber("32")).toBe(true);
    expect(isValidToothNumber("A")).toBe(true);
    expect(isValidToothNumber("T")).toBe(true);
    expect(isValidToothNumber("33")).toBe(false);
    expect(isValidToothNumber("Z")).toBe(false);
  });

  it("ProcedureLogic_SortProcedures_CanadianLabs (lines 23-53 in ProcedureLogicTests.cs)", () => {
    interface TestProc {
      id: number;
      code: string;
      parentProcId?: number;
      fee: number;
    }

    const procs: TestProc[] = [
      { id: 1, code: "04711", fee: 91.0 },
      { id: 2, code: "04712", fee: 182.0 },
      { id: 3, code: "99111", parentProcId: 1, fee: 89.0 }, // Lab for proc 1
      { id: 4, code: "99111", parentProcId: 2, fee: 23.0 }, // Lab for proc 2
      { id: 5, code: "01101", fee: 105.0 } // Independent proc
    ];

    // Sorting algorithm: Place each lab immediately after its parent procedure
    const sorted: TestProc[] = [];
    const parents = procs.filter(p => !p.parentProcId);

    for (const parent of parents) {
      sorted.push(parent);
      const labs = procs.filter(p => p.parentProcId === parent.id);
      sorted.push(...labs);
    }

    const p1Index = sorted.findIndex(p => p.id === 1);
    const lab1Index = sorted.findIndex(p => p.id === 3);
    const p2Index = sorted.findIndex(p => p.id === 2);
    const lab2Index = sorted.findIndex(p => p.id === 4);

    // Labs should always be positioned immediately following their parent procedure
    expect(lab1Index).toBe(p1Index + 1);
    expect(lab2Index).toBe(p2Index + 1);
  });
});
