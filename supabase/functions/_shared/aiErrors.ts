// supabase/functions/_shared/aiErrors.ts
//
// Centralized error classification for AI provider (OpenRouter) failures.
// The goal is to produce:
//  1) a user-facing message that points to the *exact* setting/env var likely responsible
//  2) a structured envelope for telemetry + admin diagnostics.

export type AiCulpritSource = "assistant_settings" | "env" | "computed" | "default" | "unknown";

export type AiCulprit = {
  /** The exact variable/setting name (e.g., assistant_settings.params.timeout_ms, OPENROUTER_API_KEY). */
  var: string;
  source: AiCulpritSource;
  /** Short, safe preview of the value (never secrets). */
  value_preview?: string | null;
  note?: string | null;
};

export type AiErrorEnvelope = {
  kind: "openrouter";
  /** Stable programmatic code. */
  code:
    | "AI_TIMEOUT"
    | "AI_UNAUTHORIZED"
    | "AI_RATE_LIMIT"
    | "AI_BAD_REQUEST"
    | "AI_UPSTREAM_5XX"
    | "AI_NETWORK"
    | "AI_NOT_CONFIGURED"
    | "AI_UNKNOWN";
  /** Human readable short reason. */
  reason: string;
  retryable: boolean;
  culprit?: AiCulprit | null;
  context: {
    requestId: string;
    runnerJobId?: string | null;
    status?: number | null;
    model?: string | null;
    modelsTried?: Array<{ model: string; status?: number | null; message?: string | null; variant?: string | null }>;
    payloadVariant?: string | null;
    baseUrl?: string | null;
    upstreamRequestId?: string | null;
    timeoutMs?: number | null;
  };
  raw: {
    message: string;
    name?: string | null;
    status?: number | null;
    data_preview?: string | null;
  };
};

export type AiUserErrorDetailMode = "friendly" | "code" | "technical";

export type AiUserErrorMessageConfig = {
  mode?: AiUserErrorDetailMode;
  showCulpritVar?: boolean;
  showCulpritValue?: boolean;
  showStatusModel?: boolean;
  showTraceIds?: boolean;
};


function isPlainObject(v: any): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function safePreviewValue(v: unknown, max = 180): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") {
    const s = v.trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  }
  try {
    const s = JSON.stringify(v);
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch {
    return String(v);
  }
}

function safePreviewData(data: any, max = 800): string | null {
  if (data === null || data === undefined) return null;
  const s = typeof data === "string" ? data : safePreviewValue(data, max);
  const out = String(s ?? "").replace(/\s+/g, " ").trim();
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

function pickUpstreamErrorMessage(data: any): string | null {
  // OpenRouter often returns { error: { message } } or { message }.
  if (!data) return null;
  if (typeof data === "string") return data;
  if (isPlainObject(data)) {
    const err = (data as any).error;
    if (typeof (data as any).message === "string") return (data as any).message;
    if (typeof err === "string") return err;
    if (isPlainObject(err) && typeof (err as any).message === "string") return (err as any).message;
  }
  return null;
}

export function buildAiUserFacingMessage(
  env: AiErrorEnvelope,
  cfg: AiUserErrorDetailMode | AiUserErrorMessageConfig = "technical",
): string {
  const mode: AiUserErrorDetailMode = typeof cfg === "string" ? cfg : (cfg.mode ?? "technical");

  // Derived defaults by mode (can be overridden by cfg.* fields).
  const defaults = (() => {
    if (mode === "friendly") {
      return { showCulpritVar: false, showCulpritValue: false, showStatusModel: false, showTraceIds: true };
    }
    if (mode === "code") {
      return { showCulpritVar: true, showCulpritValue: false, showStatusModel: true, showTraceIds: true };
    }
    // technical
    return { showCulpritVar: true, showCulpritValue: true, showStatusModel: true, showTraceIds: true };
  })();

  const showCulpritVar = typeof cfg === "string" ? defaults.showCulpritVar : (cfg.showCulpritVar ?? defaults.showCulpritVar);
  const showCulpritValue = typeof cfg === "string" ? defaults.showCulpritValue : (cfg.showCulpritValue ?? defaults.showCulpritValue);
  const showStatusModel = typeof cfg === "string" ? defaults.showStatusModel : (cfg.showStatusModel ?? defaults.showStatusModel);
  const showTraceIds = typeof cfg === "string" ? defaults.showTraceIds : (cfg.showTraceIds ?? defaults.showTraceIds);

  const requestId = env.context.requestId;
  const culpritVar = env.culprit?.var ? String(env.culprit.var) : null;
  const culpritVal = env.culprit?.value_preview ? String(env.culprit.value_preview) : null;

  const traceBits: string[] = [];
  if (requestId) traceBits.push(`requestId=${requestId}`);
  if (env.context.upstreamRequestId) traceBits.push(`upstream=${env.context.upstreamRequestId}`);
  if (env.context.runnerJobId) traceBits.push(`job=${env.context.runnerJobId}`);

  if (mode === "friendly") {
    const lines: string[] = [];

    // Base friendly headline.
    if (env.code === "AI_NOT_CONFIGURED") {
      lines.push("AI is not configured right now.");
    } else if (env.code === "AI_UNAUTHORIZED") {
      lines.push("AI credentials are invalid or missing.");
    } else if (env.code === "AI_RATE_LIMIT") {
      lines.push("AI is busy right now. Please try again in a moment.");
    } else if (env.code === "AI_TIMEOUT") {
      lines.push("AI took too long to respond. Please try again.");
    } else if (env.code === "AI_NETWORK") {
      lines.push("AI network error. Please try again in a moment.");
    } else {
      lines.push("I couldn’t reach the AI provider in time. Please try again in a moment.");
    }

    // Optional details (controlled by toggles).
    if (showStatusModel) {
      const bits: string[] = [];
      if (env.context.status) bits.push(`status=${env.context.status}`);
      if (env.context.model) bits.push(`model=${env.context.model}`);
      if (bits.length) lines.push(bits.join(" "));
    }

    if (showCulpritVar && culpritVar) {
      const v = showCulpritValue && culpritVal ? ` = ${culpritVal}` : "";
      lines.push(`Culprit: ${culpritVar}${v}`);
    }

    if (showTraceIds && traceBits.length) {
      lines.push(`Ref: ${traceBits.join(" ")}`);
    }

    return lines.join("\n");
  }

  if (mode === "code") {
    const lines: string[] = [];
    const head = [`AI_ERROR/${env.code}`, env.reason ? `— ${env.reason}` : ""].join(" ").trim();
    lines.push(head);

    const bits: string[] = [];
    if (showStatusModel) {
      if (env.context.status) bits.push(`status=${env.context.status}`);
      if (env.context.model) bits.push(`model=${env.context.model}`);
    }

    if (showCulpritVar && culpritVar) {
      if (showCulpritValue && culpritVal) bits.push(`culprit=${culpritVar}=${culpritVal}`);
      else bits.push(`culprit=${culpritVar}`);
    }

    if (showTraceIds) {
      if (requestId) bits.push(`req=${requestId}`);
      if (env.context.upstreamRequestId) bits.push(`upstream=${env.context.upstreamRequestId}`);
      if (env.context.runnerJobId) bits.push(`job=${env.context.runnerJobId}`);
    }

    if (bits.length) lines.push(bits.join(" "));
    return lines.join("\n");
  }

  // technical
  const parts: string[] = [];
  parts.push(`AI provider error: ${env.code}`);
  if (showStatusModel) {
    if (env.context.status) parts.push(`Status: ${env.context.status}`);
    if (env.context.model) parts.push(`Model: ${env.context.model}`);
  }
  if (showCulpritVar && culpritVar) {
    const val = showCulpritValue && culpritVal ? ` = ${culpritVal}` : "";
    parts.push(`Culprit: ${culpritVar}${val}`);
  }
  parts.push(`Reason: ${env.reason}`);
  if (showTraceIds && traceBits.length) parts.push(`Trace: ${traceBits.join(" ")}`);
  return parts.join("\n");
}


export function classifyOpenRouterError(args: {
  userFacing?: AiUserErrorDetailMode | AiUserErrorMessageConfig;
  err: any;
  requestId: string;
  runnerJobId?: string | null;
  baseUrl?: string | null;
  timeoutMs?: number | null;
  attemptedModel?: string | null;
  payloadVariant?: string | null;
  upstreamRequestId?: string | null;
  modelsTried?: Array<{ model: string; status?: number | null; message?: string | null; variant?: string | null }>;
  culprit?: AiCulprit | null;
}): { envelope: AiErrorEnvelope; userMessage: string } {
  const err = args.err;
  const status = Number((err as any)?.status ?? 0);
  const statusNorm = Number.isFinite(status) && status > 0 ? status : null;
  const message = err instanceof Error ? err.message : String(err ?? "OpenRouter error");
  const name = err instanceof Error ? err.name : null;
  const data = (err as any)?.data ?? null;

  const dataMsg = pickUpstreamErrorMessage(data);
  const dataPreview = safePreviewData(data, 800);

  const lower = `${message} ${(dataMsg ?? "")} ${(dataPreview ?? "")}`.toLowerCase();
  const isAbort =
    String(name ?? "").toLowerCase().includes("abort") ||
    Boolean((err as any)?.aborted) ||
    String((err as any)?.abortReason ?? "").toLowerCase().includes("timeout");
  const isTimeout = isAbort || lower.includes("timeout") || statusNorm === 504;

  let code: AiErrorEnvelope["code"] = "AI_UNKNOWN";
  let retryable = false;

  if (lower.includes("missing openrouter_api_key") || lower.includes("openrouter_api_key") && lower.includes("missing")) {
    code = "AI_NOT_CONFIGURED";
    retryable = false;
  } else if (statusNorm === 401 || statusNorm === 403 || lower.includes("unauthorized") || lower.includes("invalid api key")) {
    code = "AI_UNAUTHORIZED";
    retryable = false;
  } else if (statusNorm === 429 || lower.includes("rate limit")) {
    code = "AI_RATE_LIMIT";
    retryable = true;
  } else if (statusNorm === 400 || lower.includes("invalid request")) {
    code = "AI_BAD_REQUEST";
    retryable = false;
  } else if (isTimeout) {
    code = "AI_TIMEOUT";
    retryable = true;
  } else if (statusNorm && statusNorm >= 500) {
    code = "AI_UPSTREAM_5XX";
    retryable = true;
  } else if (
    lower.includes("fetch") ||
    lower.includes("dns") ||
    lower.includes("connection") ||
    lower.includes("network") ||
    lower.includes("tls")
  ) {
    code = "AI_NETWORK";
    retryable = true;
  }

  const reasonFromUpstream = dataMsg ? safePreviewValue(dataMsg, 220) : null;
  const reason =
    reasonFromUpstream ??
    (statusNorm ? `Upstream returned ${statusNorm}` : null) ??
    (isTimeout ? "Request timed out" : null) ??
    safePreviewValue(message, 220);

  const envelope: AiErrorEnvelope = {
    kind: "openrouter",
    code,
    reason,
    retryable,
    culprit: args.culprit ?? null,
    context: {
      requestId: args.requestId,
      runnerJobId: args.runnerJobId ?? null,
      status: statusNorm,
      model: args.attemptedModel ?? null,
      modelsTried: args.modelsTried ?? undefined,
      payloadVariant: args.payloadVariant ?? null,
      baseUrl: args.baseUrl ?? null,
      upstreamRequestId: args.upstreamRequestId ?? null,
      timeoutMs: args.timeoutMs ?? null,
    },
    raw: {
      message: safePreviewValue(message, 500),
      name: name ? safePreviewValue(name, 80) : null,
      status: statusNorm,
      data_preview: dataPreview,
    },
  };

  return { envelope, userMessage: buildAiUserFacingMessage(envelope, args.userFacing ?? "technical") };
}
