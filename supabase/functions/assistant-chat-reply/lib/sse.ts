import { corsHeadersFor, getRequestId, jsonResponse } from "../../_shared/http.ts";
import type { RequestPayload } from "../request.ts";

// Extracted from assistant-chat-reply/index.ts (no behavior changes).
const STREAM_CHUNK_SIZE = 24;

export function chunkText(text: string, size: number): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

export function sseResponse(req: Request, body: Record<string, unknown>, replyText?: string): Response {
  const encoder = new TextEncoder();
  const chunks = chunkText(replyText ?? "", STREAM_CHUNK_SIZE);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
      req.signal?.addEventListener("abort", close);

      const sendEvent = (event: string, data: Record<string, unknown>) => {
        if (closed || req.signal?.aborted) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          close();
        }
      };

      for (const chunk of chunks) {
        sendEvent("delta", { text: chunk });
      }
      sendEvent("done", body);
      close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeadersFor(req),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "x-request-id": getRequestId(req),
    },
  });
}

export function sseResponseAsync(
  req: Request,
  run: (sendEvent: (event: string, data: Record<string, unknown>) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
      req.signal?.addEventListener("abort", close);

      const sendEvent = (event: string, data: Record<string, unknown>) => {
        if (closed || req.signal?.aborted) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          close();
        }
      };

      try {
        await run(sendEvent);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err ?? "stream_error");
        sendEvent("error", { ok: false, error: msg.slice(0, 600) });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeadersFor(req),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "x-request-id": getRequestId(req),
    },
  });
}

export function finalizeResponse(
  req: Request,
  payload: RequestPayload,
  body: Record<string, unknown>,
  status = 200,
  replyText?: string,
): Response {
  if (payload.stream) {
    return sseResponse(req, body, replyText);
  }
  return jsonResponse(body, status, undefined, req);
}
