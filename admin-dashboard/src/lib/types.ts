export type AdminUser = {
  id: string;
  email?: string | null;
};

export type CoverageRow = {
  provider: string;
  model: string;
  count: number;
};

export type EmbeddingSettings = {
  id: number;
  active_provider: string | null;
  active_model: string | null;
  active_dimensions: number | null;
  active_task: string | null;
  rerank_swipe_enabled: boolean | null;
  rerank_search_enabled: boolean | null;
  rerank_top_k: number | null;
  updated_at?: string | null;
};

export type ActiveProfile = {
  provider: string;
  model: string;
  dimensions: number;
  task: string;
};

export type JobStateRow = {
  job_name: string;
  cursor: string | null;
  updated_at: string | null;
};

export type JobRunLog = {
  id: string | number;
  created_at?: string;
  started_at: string;
  finished_at: string;
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
  meta?: Record<string, unknown> | null;
};

export type OverviewRecentError = {
  id: string | number;
  created_at?: string;
  started_at?: string;
  job_name: string;
  error_code?: string | null;
  error_message?: string | null;
};

export type OverviewLastRun = {
  id: string | number;
  started_at: string;
  finished_at?: string | null;
  job_name: string;
  ok: boolean;
};

export type AuditLogRow = {
  id: string | number;
  created_at: string;
  admin_user_id?: string | null;
  admin_email?: string | null;
  action: string;
  target: string;
  details?: Record<string, unknown> | null;
};

export type WhoAmIResponse = {
  ok: true;
  is_admin: boolean;
  user: AdminUser | null;
};

export type OverviewResponse = {
  ok: true;
  active_profile: ActiveProfile | null;
  coverage: CoverageRow[];
  last_job_runs: OverviewLastRun[];
  recent_errors: OverviewRecentError[];
  job_state: JobStateRow[];
};

export type EmbeddingsResponse = {
  ok: true;
  embedding_settings: EmbeddingSettings | null;
  coverage: CoverageRow[];
};

export type AssistantSettings = {
  id: number;
  openrouter_base_url?: string | null;
  model_fast?: string | null;
  model_creative?: string | null;
  model_planner?: string | null;
  model_maker?: string | null;
  model_critic?: string | null;
  fallback_models: string[];
  model_catalog: string[];
  default_instructions?: string | null;
  params: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AssistantSettingsResponse = {
  ok: true;
  assistant_settings: AssistantSettings;
  defaults?: {
    model_catalog?: string[];
    settings?: AssistantSettings;
  };
};

export type JobsResponse = {
  ok: true;
  job_state: JobStateRow[];
  cron_jobs: Array<{ jobid: number; jobname: string; schedule: string; active: boolean }>;
};

export type UsersResponse = {
  ok: true;
  users: Array<{ id: string; email?: string | null; created_at?: string; banned_until?: string | null }>;
  next_page: string | null;
};

export type LogsResponse = {
  ok: true;
  rows: JobRunLog[];
  next_before: string | null;
};

export type CostsResponse = {
  ok: true;
  daily: Array<{ day: string; provider: string; tokens: number }>;
  today: {
    day: string;
    used: number;
    budget: number | null;
    remaining: number | null;
  };
  today_by_provider: Array<{
    provider: string;
    used: number;
    budget: number | null;
    remaining: number | null;
  }>;
  budgets: {
    total_daily: number | null;
    by_provider_daily: Record<string, number>;
  };
};

export type AuditResponse = {
  ok: true;
  rows: AuditLogRow[];
  next_before: string | null;
};
