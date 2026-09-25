import { DurableObject } from "cloudflare:workers";
import type { Env } from "../types.js";

interface ScheduleLock {
  opId: number;
  timeSlot: string; // ISO 8601
  lockedBy: string;
  expiresAt: number;
}

export class AppointmentScheduleDO extends DurableObject<Env> {
  private activeLocks: Map<string, ScheduleLock> = new Map();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for real-time operatory schedule sync
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({
        type: "CONNECTED",
        message: "Connected to Cloudflare Durable Object Appointment Schedule",
        timestamp: new Date().toISOString()
      }));

      return new Response(null, { status: 101, webSocket: client });
    }

    // HTTP Slot Lock Acquisition to prevent double-booking
    if (url.pathname === "/lock" && request.method === "POST") {
      const body = await request.json() as { opId: number; timeSlot: string; user: string };
      const lockKey = `${body.opId}:${body.timeSlot}`;
      const now = Date.now();

      const existing = this.activeLocks.get(lockKey);
      if (existing && existing.expiresAt > now && existing.lockedBy !== body.user) {
        return Response.json({
          success: false,
          error: "SLOT_LOCKED",
          message: `Operatory is currently locked by ${existing.lockedBy}`,
          lockedBy: existing.lockedBy
        }, { status: 409 });
      }

      // 60-second lease
      this.activeLocks.set(lockKey, {
        opId: body.opId,
        timeSlot: body.timeSlot,
        lockedBy: body.user,
        expiresAt: now + 60_000
      });

      this.broadcast({
        type: "SLOT_LOCKED",
        opId: body.opId,
        timeSlot: body.timeSlot,
        lockedBy: body.user
      });

      return Response.json({ success: true, leaseDurationSec: 60 });
    }

    // Broadcast appointment update to all connected operatory terminals
    if (url.pathname === "/broadcast" && request.method === "POST") {
      const payload = await request.json();
      this.broadcast(payload);
      return Response.json({ success: true, clientCount: this.ctx.getWebSockets().length });
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = typeof message === "string" ? JSON.parse(message) : {};
      if (data.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
      }
    } catch {
      // Ignore malformed ping
    }
  }

  webSocketClose(ws: WebSocket) {
    ws.close();
  }

  private broadcast(data: unknown) {
    const serialized = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(serialized);
      } catch {
        // Drop disconnected client
      }
    }
  }
}
