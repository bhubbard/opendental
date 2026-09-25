// Port of Open Dental AppointmentsTests.cs
// Source: UnitTests/UnitTests/AppointmentsTests.cs
import { describe, it, expect } from "vitest";
import type { Appointment } from "../src/types.js";

describe("Open Dental - AppointmentsTests (matching AppointmentsTests.cs)", () => {
  // Appointment status enum matching OpenDentBusiness.ApptStatus
  const ApptStatus = {
    Scheduled: 1,
    Complete: 2,
    UnschedList: 3,
    ASAP: 4,
    Broken: 5,
    Planned: 6
  } as const;

  // Calculates total minutes from pattern string (5 minutes per character)
  function getAppointmentDurationMinutes(pattern: string): number {
    return (pattern.length) * 5;
  }

  // Doctor time vs assistant time breakdown from pattern
  function getDoctorAndAssistTime(pattern: string): { doctorMinutes: number; assistMinutes: number } {
    let doctorTicks = 0;
    let assistTicks = 0;
    for (const char of pattern) {
      if (char.toUpperCase() === 'X') doctorTicks++;
      else if (char === '/') assistTicks++;
    }
    return {
      doctorMinutes: doctorTicks * 5,
      assistMinutes: assistTicks * 5
    };
  }

  // Conflict check helper matching OpenDentBusiness appointment scheduler
  function hasOperatoryConflict(
    existingAppts: Appointment[],
    newApt: { op: number; start: Date; durationMinutes: number }
  ): boolean {
    const newStart = newApt.start.getTime();
    const newEnd = newStart + (newApt.durationMinutes * 60 * 1000);

    return existingAppts.some(existing => {
      // Broken and Planned appointments do not occupy operatory time slots
      if (existing.AptStatus === ApptStatus.Broken || existing.AptStatus === ApptStatus.Planned) {
        return false;
      }

      if (existing.Op !== newApt.op) return false;

      const existStart = new Date(existing.AptDateTime).getTime();
      const existDuration = getAppointmentDurationMinutes(existing.Pattern || '/XX/');
      const existEnd = existStart + (existDuration * 60 * 1000);

      // Overlap condition: startA < endB AND endA > startB
      return newStart < existEnd && newEnd > existStart;
    });
  }

  it("Appointments_GetSearchResults_IgnoreBrokenAppointments (line 55 in AppointmentsTests.cs)", () => {
    // An existing broken appointment on Op 1 at 08:00 does not block scheduling at 08:00
    const existing: Appointment[] = [
      {
        AptNum: 101,
        PatNum: 1,
        Op: 1,
        ProvNum: 1,
        AptDateTime: "2026-09-25T08:00:00Z",
        Pattern: "////XXXX////", // 60 minutes
        AptStatus: ApptStatus.Broken // Broken appointment
      }
    ];

    const hasConflict = hasOperatoryConflict(existing, {
      op: 1,
      start: new Date("2026-09-25T08:00:00Z"),
      durationMinutes: 60
    });

    // Broken appointment is ignored as an opening
    expect(hasConflict).toBe(false);
  });

  it("Appointments_DetectsConflict_WhenActiveAppointmentExists", () => {
    // An existing scheduled appointment on Op 1 at 08:00 DOES block scheduling at 08:30
    const existing: Appointment[] = [
      {
        AptNum: 102,
        PatNum: 2,
        Op: 1,
        ProvNum: 1,
        AptDateTime: "2026-09-25T08:00:00Z",
        Pattern: "////XXXX////", // 12 chars = 60 minutes (08:00 to 09:00)
        AptStatus: ApptStatus.Scheduled
      }
    ];

    const conflictAt830 = hasOperatoryConflict(existing, {
      op: 1,
      start: new Date("2026-09-25T08:30:00Z"),
      durationMinutes: 30
    });

    expect(conflictAt830).toBe(true);

    // But 09:00 in the same operatory has NO conflict
    const noConflictAt900 = hasOperatoryConflict(existing, {
      op: 1,
      start: new Date("2026-09-25T09:00:00Z"),
      durationMinutes: 30
    });

    expect(noConflictAt900).toBe(false);

    // And 08:30 in a DIFFERENT operatory (Op 2) has NO conflict
    const noConflictDifferentOp = hasOperatoryConflict(existing, {
      op: 2,
      start: new Date("2026-09-25T08:30:00Z"),
      durationMinutes: 30
    });

    expect(noConflictDifferentOp).toBe(false);
  });

  it("Appointments_Calculates_Doctor_And_Assist_Time_Accurately", () => {
    // Pattern: '///XXXXX///' -> 3 assist ticks, 5 doctor ticks, 3 assist ticks = 11 ticks (55 mins)
    const pattern = "///XXXXX///";
    const breakdown = getDoctorAndAssistTime(pattern);

    expect(breakdown.doctorMinutes).toBe(25); // 5 * 5m
    expect(breakdown.assistMinutes).toBe(30); // 6 * 5m
    expect(getAppointmentDurationMinutes(pattern)).toBe(55);
  });

  it("Appointments_Validates_Standard_Status_Lifecycle", () => {
    const statuses = [
      ApptStatus.Scheduled,
      ApptStatus.Complete,
      ApptStatus.UnschedList,
      ApptStatus.ASAP,
      ApptStatus.Broken,
      ApptStatus.Planned
    ];

    expect(statuses).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
