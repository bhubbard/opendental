import { Hono } from "hono";
import type { Env } from "../types.js";

export const perioRoutes = new Hono<{ Bindings: Env }>();

export interface PerioMeasureItem {
  ToothNum: number;
  SequenceType: number; // 0=Probing, 1=Bleeding, 2=Suppuration, 3=GingivalMargin, 4=Mobility, 5=Furcation
  MB: number;
  B: number;
  DB: number;
  ML: number;
  L: number;
  DL: number;
}

// GET /api/v1/perio/exams?patNum=:id - Get latest perio exams
perioRoutes.get("/exams", async (c) => {
  const patNum = c.req.query("patNum");
  if (!patNum) return c.json({ success: false, error: "patNum query parameter required" }, 400);

  const exams = await c.env.DB.prepare(`
    SELECT pe.*, pr.Abbr as ProvAbbr
    FROM perioexam pe
    JOIN provider pr ON pe.ProvNum = pr.ProvNum
    WHERE pe.PatNum = ?
    ORDER BY pe.ExamDate DESC
  `).bind(Number(patNum)).all();

  return c.json({
    success: true,
    patNum: Number(patNum),
    exams: exams.results
  });
});

// GET /api/v1/perio/measures?examNum=:id - Get full 6-site chart for exam
perioRoutes.get("/measures", async (c) => {
  const examNum = c.req.query("examNum");
  if (!examNum) return c.json({ success: false, error: "examNum query parameter required" }, 400);

  const measures = await c.env.DB.prepare(`
    SELECT * FROM periomeasure
    WHERE PerioExamNum = ?
    ORDER BY ToothNum ASC, SequenceType ASC
  `).bind(Number(examNum)).all<PerioMeasureItem>();

  return c.json({
    success: true,
    examNum: Number(examNum),
    count: measures.results.length,
    measures: measures.results
  });
});

// POST /api/v1/perio/exams - Create new exam with probing records
perioRoutes.post("/exams", async (c) => {
  const body = await c.req.json<{
    patNum: number;
    provNum: number;
    examDate?: string;
    measures?: PerioMeasureItem[];
  }>();

  if (!body.patNum || !body.provNum) {
    return c.json({ success: false, error: "patNum and provNum are required" }, 400);
  }

  const examDate = body.examDate || new Date().toISOString().split("T")[0];

  const examRes = await c.env.DB.prepare(`
    INSERT INTO perioexam (PatNum, ExamDate, ProvNum)
    VALUES (?, ?, ?)
  `).bind(body.patNum, examDate, body.provNum).run();

  const examNum = examRes.meta.last_row_id as number;

  if (body.measures && body.measures.length > 0) {
    const stmts = body.measures.map(m => {
      return c.env.DB.prepare(`
        INSERT INTO periomeasure (
          PerioExamNum, ToothNum, SequenceType, MB, B, DB, ML, L, DL
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        examNum,
        m.ToothNum,
        m.SequenceType,
        m.MB,
        m.B,
        m.DB,
        m.ML,
        m.L,
        m.DL
      );
    });

    await c.env.DB.batch(stmts);
  }

  return c.json({
    success: true,
    examNum,
    message: "Periodontal examination recorded successfully"
  }, 201);
});
