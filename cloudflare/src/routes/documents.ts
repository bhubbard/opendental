import { Hono } from "hono";
import type { Env, DocumentRecord } from "../types.js";

export const documentRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/documents - List documents for patient
documentRoutes.get("/", async (c) => {
  const patNum = c.req.query("patNum");
  if (!patNum) return c.json({ success: false, error: "patNum query parameter required" }, 400);

  const result = await c.env.DB.prepare(
    "SELECT * FROM document WHERE PatNum = ? ORDER BY DateCreated DESC"
  ).bind(Number(patNum)).all<DocumentRecord>();

  return c.json({
    success: true,
    patNum: Number(patNum),
    count: result.results.length,
    documents: result.results
  });
});

// POST /api/v1/documents/upload - Upload file to Cloudflare R2
documentRoutes.post("/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const patNum = formData.get("patNum");
  const description = formData.get("description") || "";
  const category = Number(formData.get("category") || 1);

  if (!file || !patNum) {
    return c.json({ success: false, error: "file and patNum are required form fields" }, 400);
  }

  // Construct HIPAA-safe key in Cloudflare R2: patients/{patNum}/{timestamp}_{filename}
  const timestamp = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r2Key = `patients/${patNum}/${timestamp}_${safeFilename}`;

  // Stream to R2 Bucket
  const fileBuffer = await file.arrayBuffer();
  await c.env.DOCUMENTS_BUCKET.put(r2Key, fileBuffer, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    },
    customMetadata: {
      patNum: String(patNum),
      originalName: file.name
    }
  });

  // Record in D1
  const result = await c.env.DB.prepare(`
    INSERT INTO document (
      PatNum, FileName, DocCategory, Description,
      R2Key, ContentType, FileSize
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    Number(patNum),
    file.name,
    category,
    String(description),
    r2Key,
    file.type || "application/octet-stream",
    file.size
  ).run();

  return c.json({
    success: true,
    DocNum: result.meta.last_row_id,
    fileName: file.name,
    r2Key,
    fileSize: file.size,
    message: "Document uploaded to Cloudflare R2 successfully"
  }, 201);
});

// GET /api/v1/documents/:id/download - Stream file directly from Cloudflare R2
documentRoutes.get("/:id/download", async (c) => {
  const id = Number(c.req.param("id"));
  const doc = await c.env.DB.prepare("SELECT * FROM document WHERE DocNum = ?")
    .bind(id)
    .first<DocumentRecord>();

  if (!doc) return c.json({ success: false, error: "Document not found" }, 404);

  const r2Object = await c.env.DOCUMENTS_BUCKET.get(doc.R2Key);
  if (!r2Object) {
    return c.json({ success: false, error: "File object not found in R2 storage" }, 404);
  }

  const headers = new Headers();
  r2Object.writeHttpMetadata(headers);
  headers.set("etag", r2Object.httpEtag);
  headers.set("Content-Disposition", `inline; filename="${doc.FileName}"`);

  return new Response(r2Object.body, { headers });
});
