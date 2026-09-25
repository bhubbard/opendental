import { DurableObject } from "cloudflare:workers";
import type { Env } from "../types.js";

export interface ToothCondition {
  toothNum: string; // 1-32 or A-T
  status: "healthy" | "decay" | "restored" | "crown" | "implant" | "missing" | "rct";
  surfaces: string[]; // ['M', 'O', 'D', 'B', 'L']
  notes?: string;
  procCode?: string;
}

export class ToothChartDO extends DurableObject<Env> {
  private conditions: Map<string, ToothCondition> = new Map();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket connection for real-time charting
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({
        type: "CHART_INITIAL_STATE",
        conditions: Object.fromEntries(this.conditions)
      }));

      return new Response(null, { status: 101, webSocket: client });
    }

    // Get current patient tooth chart
    if (url.pathname === "/state" && request.method === "GET") {
      return Response.json({
        success: true,
        conditions: Object.fromEntries(this.conditions)
      });
    }

    // Update single tooth condition
    if (url.pathname === "/update-tooth" && request.method === "POST") {
      const condition = await request.json() as ToothCondition;
      this.conditions.set(condition.toothNum, condition);

      // Broadcast update to all operatory chairside tablets
      this.broadcast({
        type: "TOOTH_UPDATED",
        tooth: condition
      });

      return Response.json({ success: true, updated: condition });
    }

    return new Response("Not found", { status: 404 });
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
        // Drop dead connection
      }
    }
  }
}
