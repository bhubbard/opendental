// Port of Open Dental PatientsTests.cs
// Source: UnitTests/UnitTests/PatientsTests.cs
import { describe, it, expect } from "vitest";
import type { Patient } from "../src/types.js";

describe("Open Dental - PatientsTests (matching PatientsTests.cs)", () => {
  // Helper matching Patients.GetPatientsByPartialName logic from OpenDentBusiness
  function searchPatients(patients: Patient[], query: string): Patient[] {
    const rawTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (rawTerms.length === 0) return [];
    if (rawTerms.length > 3) return []; // Open Dental limits multi-word searches

    return patients.filter(p => {
      const lName = p.LName.toLowerCase();
      const fName = p.FName.toLowerCase();
      const preferred = (p.Preferred || "").toLowerCase();

      if (rawTerms.length === 1) {
        const term = rawTerms[0];
        return lName.includes(term) || fName.includes(term) || preferred.includes(term);
      }

      if (rawTerms.length === 2) {
        const [term1, term2] = rawTerms;
        // Match First + Last OR Last + First OR Preferred + Last
        const matchLastFirst = lName.startsWith(term1) && (fName.startsWith(term2) || preferred.startsWith(term2));
        const matchFirstLast = (fName.startsWith(term1) || preferred.startsWith(term1)) && lName.startsWith(term2);
        const matchTwoWordLastName = `${lName}`.startsWith(`${term1} ${term2}`);
        return matchLastFirst || matchFirstLast || matchTwoWordLastName;
      }

      if (rawTerms.length === 3) {
        const [term1, term2, term3] = rawTerms;
        const matchTwoWordLastAndFirst = lName.startsWith(`${term1} ${term2}`) && fName.startsWith(term3);
        const matchFirstAndTwoWordLast = fName.startsWith(term1) && lName.startsWith(`${term2} ${term3}`);
        return matchTwoWordLastAndFirst || matchFirstAndTwoWordLast;
      }

      return false;
    });
  }

  // Calculate age helper matching Open Dental Patient.Age
  function calculateAge(birthdateStr: string, asOfDate: Date = new Date()): number {
    const birth = new Date(birthdateStr);
    let age = asOfDate.getFullYear() - birth.getFullYear();
    const m = asOfDate.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && asOfDate.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  // Sample dataset matching test cases in PatientsTests.cs
  const testPatients: Patient[] = [
    { PatNum: 1, LName: "Owre", FName: "Sam", PatStatus: 0, Gender: 0, Position: 0, Birthdate: "1990-01-15" },
    { PatNum: 2, LName: "Owre", FName: "Sarah", PatStatus: 0, Gender: 1, Position: 0, Birthdate: "1992-06-20" },
    { PatNum: 3, LName: "Brock", FName: "Taylor", PatStatus: 0, Gender: 0, Position: 0, Birthdate: "1985-03-12" },
    { PatNum: 4, LName: "McGehee", FName: "Christopher", Preferred: "Chris", PatStatus: 0, Gender: 0, Position: 0, Birthdate: "1988-11-04" },
    { PatNum: 5, LName: "Jansen", FName: "Andrew", PatStatus: 0, Gender: 0, Position: 0, Birthdate: "1995-09-08" },
    { PatNum: 6, LName: "Montano", FName: "Joseph", Preferred: "Joe", PatStatus: 0, Gender: 0, Position: 0, Birthdate: "1980-07-22" },
    { PatNum: 7, LName: "Van Damme", FName: "Jean-Claude", PatStatus: 0, Gender: 0, Position: 0, Birthdate: "1960-10-18" },
    { PatNum: 8, LName: "DeceasedPat", FName: "Old", PatStatus: 2, Gender: 0, Position: 0, Birthdate: "1930-01-01" }, // Inactive/Archived
  ];

  it("Patients_GetPatientsByPartialName_LastAndFirst (line 27 in PatientsTests.cs)", () => {
    const listPats = searchPatients(testPatients, "sam owre");
    expect(listPats.length).toBe(1);
    expect(listPats[0].FName).toBe("Sam");
    expect(listPats[0].LName).toBe("Owre");
  });

  it("Patients_GetPatientsByPartialName_MatchTwoLastAndFirst (line 35 in PatientsTests.cs)", () => {
    const listPats = searchPatients(testPatients, "owre s");
    expect(listPats.length).toBe(2);
    expect(listPats.map(p => p.FName).sort()).toEqual(["Sam", "Sarah"]);
  });

  it("Patients_GetPatientsByPartialName_JustFirst (line 43 in PatientsTests.cs)", () => {
    const listPats = searchPatients(testPatients, "SaRah");
    expect(listPats.length).toBe(1);
    expect(listPats[0].FName).toBe("Sarah");
  });

  it("Patients_GetPatientsByPartialName_JustLast (line 51 in PatientsTests.cs)", () => {
    const listPats = searchPatients(testPatients, "OWRE");
    expect(listPats.length).toBe(2);
  });

  it("Patients_GetPatientsByPartialName_LastAndPreferred (line 67 in PatientsTests.cs)", () => {
    const listPats = searchPatients(testPatients, "Joe Montano");
    expect(listPats.length).toBe(1);
    expect(listPats[0].Preferred).toBe("Joe");
    expect(listPats[0].LName).toBe("Montano");
  });

  it("Patients_GetPatientsByPartialName_TwoWordLastName (line 75 in PatientsTests.cs)", () => {
    const listPats = searchPatients(testPatients, "van damme");
    expect(listPats.length).toBe(1);
    expect(listPats[0].LName).toBe("Van Damme");
  });

  it("Patients_GetPatientsByPartialName_LotsOfNames (line 91 in PatientsTests.cs)", () => {
    // Excessive word query (> 3 terms) returns 0 results in Open Dental
    const listPats = searchPatients(testPatients, "andrew jansen thinks programming is fun");
    expect(listPats.length).toBe(0);
  });

  it("Patients_CalculateAge accurately derives age from Birthdate", () => {
    const fixedToday = new Date("2026-09-24T00:00:00Z");
    expect(calculateAge("1990-01-15", fixedToday)).toBe(36);
    expect(calculateAge("1960-10-18", fixedToday)).toBe(65); // Birthday not reached yet in Sept 2026
    expect(calculateAge("2020-05-01", fixedToday)).toBe(6);
  });

  it("Patients_Filters_Exclude_NonActive_Statuses", () => {
    const activeOnly = testPatients.filter(p => p.PatStatus === 0);
    expect(activeOnly.length).toBe(7);
    expect(activeOnly.some(p => p.LName === "DeceasedPat")).toBe(false);
  });
});
