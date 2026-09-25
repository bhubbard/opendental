import { describe, it, expect } from "vitest";
import { applyWindowing, generateBridgePayload } from "../src/routes/imaging.js";

describe("Open Dental - Imaging & DICOM Subsystem", () => {
  it("applyWindowing_Transforms16BitTo8BitGrayscale", () => {
    // 16-bit raw pixel array (values 0 - 4095)
    // WindowCenter = 2048, WindowWidth = 1000 => Min = 1548, Max = 2548
    const rawPixels = new Uint16Array([
      1000, // Below min => should clip to 0
      1548, // Exactly min => 0
      2048, // Center => ~128
      2548, // Exactly max => 255
      3000  // Above max => should clip to 255
    ]);

    const result = applyWindowing(rawPixels, 2048, 1000, false);

    expect(result.length).toBe(5);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(128); // midpoint
    expect(result[3]).toBe(255);
    expect(result[4]).toBe(255);
  });

  it("applyWindowing_Invert_ProducesInvertedContrastForBoneDensity", () => {
    const rawPixels = new Uint16Array([1548, 2548]);
    const normal = applyWindowing(rawPixels, 2048, 1000, false);
    const inverted = applyWindowing(rawPixels, 2048, 1000, true);

    expect(normal[0]).toBe(0);
    expect(inverted[0]).toBe(255);
    expect(normal[1]).toBe(255);
    expect(inverted[1]).toBe(0);
  });

  it("generateBridgePayload_Dexis_GeneratesInfoFileAndUri", () => {
    const patient = {
      PatNum: 1042,
      LName: "Smith",
      FName: "Robert",
      Birthdate: "1980-05-15",
      Gender: 1 // Male
    };

    const payload = generateBridgePayload("dexis", patient);

    expect(payload.bridge).toBe("Dexis");
    expect(payload.executable).toBe("Dexis.exe");
    expect(payload.infoFileContent).toBe("1042\r\nSMITH\r\nROBERT\r\n19800515\r\nM\r\n");
    expect(payload.protocolUri).toContain("dexis://open?id=1042&last=SMITH&first=ROBERT");
  });

  it("generateBridgePayload_Schick_GeneratesCdrAppArgs", () => {
    const patient = {
      PatNum: 2011,
      LName: "Johnson",
      FName: "Sarah"
    };

    const payload = generateBridgePayload("schick", patient);

    expect(payload.bridge).toBe("Schick");
    expect(payload.executable).toBe("CdrApp.exe");
    expect(payload.commandLineArgs).toBe('/P:2011 /N:"JOHNSON, SARAH"');
    expect(payload.protocolUri).toContain("cdr://open?patnum=2011");
  });

  it("generateBridgePayload_XVWeb_GeneratesCloudLaunchUrl", () => {
    const patient = {
      PatNum: 5543,
      LName: "Davis",
      FName: "Michael"
    };

    const payload = generateBridgePayload("xvweb", patient);

    expect(payload.bridge).toBe("XVWeb");
    expect(payload.cloudUrl).toBe("https://cloud.xvweb.com/viewer?patientId=5543");
  });
});
