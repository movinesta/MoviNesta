# Recommender offline evaluation (starter kit)

This folder contains small **Node scripts** to export interaction data from Supabase and run a simple offline benchmark.

The goal is to make it easy to iterate on recommendation logic without guessing whether changes help.

## 1) Export interactions

Exports rows from `public.media_events` (likes/dislikes/impressions/etc.) into a local JSONL file.

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  node scripts/recsys/export_interactions.mjs --days 30 --out ./tmp/media_events_30d.jsonl
```

## 1b) Export item metadata (for novelty/diversity)

Exports rows from `public.media_items` into a local JSONL file. We only export the
lightweight fields needed for evaluation (primarily OMDb genres).

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  node scripts/recsys/export_items.mjs --out ./tmp/media_items.jsonl
```

## 2) Run a tiny offline baseline

This baseline uses a **global popularity** list (over the train split) and evaluates on a holdout split.

```bash
node scripts/recsys/offline_eval_baseline.mjs --in ./tmp/media_events_30d.jsonl --k 20
```

## 3) Richer offline ranking metrics

Computes ranking metrics with **multiple holdout points per user**:
HitRate@K, MRR@K, NDCG@K, MAP@K, and basic catalog coverage.

```bash
node scripts/recsys/offline_eval_ranking.mjs --in ./tmp/media_events_30d.jsonl --k 20 --test_points 3
```

## 4) Time-split eval + beyond-accuracy metrics

Time-based split per user (train on earlier positives, test on later positives), plus
starter beyond-accuracy metrics:
- novelty (inverse log popularity)
- intra-list diversity (genre Jaccard)

```bash
node scripts/recsys/offline_eval_timesplit.mjs \
  --events ./tmp/media_events_30d.jsonl \
  --items ./tmp/media_items.jsonl \
  --k 20 --test_points 3
```

## What to add next

1. **Time-based split** per user (train on earlier, test on later).
2. Add additional metrics: NDCG@K, MAP@K, coverage, novelty.
3. Add baselines:
   - recently popular
   - genre-aware popularity
   - simple item2vec / matrix factorization
4. Add an experiment runner to compare candidates and print a report.

> Note: these scripts are intentionally dependency-light and do not impact the frontend build.

## Co-visitation baseline (item-item)

This is a strong early-stage baseline (often beats pure popularity) and requires no embeddings.

1) Train the model:

```bash
node scripts/recsys/train_covisit.mjs --days 90 --topk 200 --out covisit_model.json
```

2) Export outcomes (derived from `public.media_events`) to JSONL:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...   node scripts/recsys/export_rec_logs.mjs --days 90 --outDir ./tmp
# outputs: ./tmp/rec_outcomes.jsonl
```

3) Evaluate leave-one-out:

```bash
node scripts/recsys/offline_eval_covisit.mjs --events ./tmp/rec_outcomes.jsonl --model covisit_model.json --k 10
```

## Deck telemetry exports (rec_impressions / rec_outcomes)

Export recent recommendation telemetry (served impressions + outcomes) for offline analysis and calibration:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/recsys/export_rec_logs.mjs --days 30 --outDir ./tmp
# outputs: ./tmp/rec_impressions.jsonl, ./tmp/rec_outcomes.jsonl, and ./tmp/media_events.jsonl
```

## Suggest blend calibration multipliers

Given the exported telemetry, compute **suggested per-source multipliers** (normalized to overall like-rate) that you can paste into Admin Settings:

```bash
node scripts/recsys/suggest_blend_calibration.mjs --objective "like:0.7,watchlist:0.3" \
  --impr ./tmp/rec_impressions.jsonl \
  --outcomes ./tmp/rec_outcomes.jsonl \
  --out ./tmp/blend_calibration_suggestion.json
```

This produces a JSON file with:
- `suggested_source_multipliers` (the values to apply)
- `per_source` (debug stats)

Then in Admin Dashboard → Recsys → Swipe Blend Calibration, paste these values into **Source multipliers** and validate via the variant metrics page.
