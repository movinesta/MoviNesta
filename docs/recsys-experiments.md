# Recsys Experiments

## Overview
Recsys experiments let us A/B test recommendation changes with sticky assignment and auditable metrics. Each experiment has a unique `key`, a `status` (`draft`, `active`, `ended`), and a set of weighted `variants` (e.g. control vs treatment). Admins can create, activate, end, and override user assignments from the Admin Dashboard.

## Variants and weights
Variants are stored as JSON in `rec_experiments.variants` and look like:

```json
[
  { "name": "control", "weight": 0.5 },
  { "name": "treatment", "weight": 0.5 }
]
```

Weights are normalized during assignment; each user gets a stable (sticky) variant based on a hash of `salt + user_id`.

## Sticky assignment
Assignments are written to `rec_user_experiment_assignments`.

- **Auto assignment:** `rec_assign_variant(experiment_key, user_id)` computes a deterministic variant and upserts it as `assignment_mode = 'auto'`.
- **Manual override:** `rec_set_user_variant(experiment_key, user_id, variant, admin_id)` upserts a manual assignment with `assignment_mode = 'manual'` and `assigned_by`.

This ensures repeat requests return the same variant unless an admin override is applied.

## Admin controls
From the Admin Dashboard:

- Create/edit experiments, rotate salt, activate or end experiments.
- View experiment detail charts derived from daily metrics.
- Search for a user and force a variant or reset to auto assignment.

Admin UI uses service-role protected edge functions; clients should not write to experiments or assignments directly.

## Metrics and telemetry
Experiment metrics are derived from impressions, not just assignments.

- Every impression should include a flat experiments map on `rec_impressions.request_context.experiments`:

```json
{
  "experiments": {
    "swipe_blend_test": "A",
    "diversity_cap_v1": "B"
  }
}
```

- `rec_variant_daily_metrics_v1` expands `request_context.experiments` via `jsonb_each_text()` and joins to outcomes.

If impressions are not tagged, experiment metrics will show no data even if assignments exist.

## Key SQL helpers

```sql
select * from rec_active_experiments();
select rec_assign_variant('swipe_blend_test', '00000000-0000-0000-0000-000000000000');
select rec_set_user_variant('swipe_blend_test', '00000000-0000-0000-0000-000000000000', 'treatment', '11111111-1111-1111-1111-111111111111');
```

## Debug queries

```sql
-- Confirm impressions are tagged
select created_at, request_context->'experiments'
from rec_impressions
order by created_at desc
limit 20;

-- Experiment metrics for recent days
select *
from rec_variant_daily_metrics_v1
where day >= current_date - 7
order by day desc
limit 50;

-- Latest assignments
select *
from rec_user_experiment_assignments
order by assigned_at desc
limit 20;
```
