// supabase/functions/_shared/joblog.ts
//
// Best-effort job run logging into public.job_run_log.
//
// This table is RLS-denied to clients; inserts must be done with a service role client.
// Jobs should treat logging as non-blocking: failures must not fail the job.

export type JobRunLogRow = {
  started_at?: string;
  finished_at?: string;
  job_name: string;
  provider?: string | null;
  model?: string | null;
  ok: boolean;
  scanned?: number | null;
  embedded?: number | null;
  skipped_existing?: number | null;
  total_tokens?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  meta?: Record<string, unknown>;
};

export async function safeInsertJobRunLog(
  supabase: any,
  row: JobRunLogRow,
): Promise<void> {
  try {
    const payload = {
      started_at: row.started_at ?? new Date().toISOString(),
      finished_at: row.finished_at ?? new Date().toISOString(),
      job_name: row.job_name,
      provider: row.provider ?? null,
      model: row.model ?? null,
      ok: Boolean(row.ok),
      scanned: row.scanned ?? null,
      embedded: row.embedded ?? null,
      skipped_existing: row.skipped_existing ?? null,
      total_tokens: row.total_tokens ?? null,
      error_code: row.error_code ?? null,
      error_message: row.error_message ?? null,
      meta: row.meta ?? {},
    };

    const { error } = await supabase.from("job_run_log").insert(payload);
    if (error) {
      console.warn("JOB_RUN_LOG_INSERT_FAILED", error.message);
    }
  } catch (e) {
    console.warn(
      "JOB_RUN_LOG_INSERT_FAILED",
      (e as any)?.message ?? String(e),
    );
  }
}
