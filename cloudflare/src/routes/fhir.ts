import { Hono } from "hono";
import type { Env, Patient, ProcedureLog } from "../types.js";

export const fhirRoutes = new Hono<{ Bindings: Env }>();

// FHIR R4 Patient Endpoint
fhirRoutes.get("/Patient/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const pat = await c.env.DB.prepare("SELECT * FROM patient WHERE PatNum = ?")
    .bind(id)
    .first<Patient>();

  if (!pat) {
    return c.json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }]
    }, 404);
  }

  // FHIR R4 Patient Resource
  const fhirPatient = {
    resourceType: "Patient",
    id: String(pat.PatNum),
    identifier: [
      {
        system: "urn:oid:opendental:patient-id",
        value: String(pat.PatNum)
      }
    ],
    active: pat.PatStatus === 0,
    name: [
      {
        use: "official",
        family: pat.LName,
        given: [pat.FName, pat.MiddleI].filter(Boolean)
      }
    ],
    telecom: [
      pat.WirelessPhone ? { system: "phone", value: pat.WirelessPhone, use: "mobile" } : null,
      pat.Email ? { system: "email", value: pat.Email } : null
    ].filter(Boolean),
    gender: pat.Gender === 0 ? "male" : pat.Gender === 1 ? "female" : "unknown",
    birthDate: pat.Birthdate,
    address: [
      {
        line: [pat.Address, pat.Address2].filter(Boolean),
        city: pat.City,
        state: pat.State,
        postalCode: pat.Zip
      }
    ]
  };

  return c.json(fhirPatient);
});

// FHIR R4 Coverage (Insurance)
fhirRoutes.get("/Coverage", async (c) => {
  const patNum = c.req.query("patient");
  if (!patNum) {
    return c.json({ resourceType: "Bundle", type: "searchset", entry: [] });
  }

  const plans = await c.env.DB.prepare(`
    SELECT pp.*, ip.GroupName, ip.GroupNum, c.CarrierName, c.PayerID
    FROM patplan pp
    JOIN insplan ip ON pp.PlanNum = ip.PlanNum
    JOIN carrier c ON ip.CarrierNum = c.CarrierNum
    WHERE pp.PatNum = ?
  `).bind(Number(patNum)).all<{
    PatPlanNum: number;
    PatNum: number;
    GroupName: string;
    GroupNum: string;
    CarrierName: string;
    PayerID: string;
    Ordinal: number;
  }>();

  const entries = plans.results.map(plan => ({
    resource: {
      resourceType: "Coverage",
      id: String(plan.PatPlanNum),
      status: "active",
      beneficiary: { reference: `Patient/${plan.PatNum}` },
      payor: [{ display: plan.CarrierName }],
      order: plan.Ordinal,
      class: [
        {
          type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/coverage-class", code: "group" }] },
          value: plan.GroupNum,
          name: plan.GroupName
        }
      ]
    }
  }));

  return c.json({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  });
});
