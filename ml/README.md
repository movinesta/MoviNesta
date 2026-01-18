# MoviNesta ML training (starter scaffold)

This folder contains a minimal scaffold for running recommender training jobs **outside**
the Vite frontend build and **publishing** results back to Supabase.

The scaffold is designed to be:

- **Easy** to run locally or in CI (GitHub Actions scheduled workflow)
- **Reproducible** (explicit exports + deterministic seeds)
- **Safe** (writes use service-role only; reads can be anon/auth)

## First model: Implicit ALS (matrix factorization)

We start with Implicit-feedback ALS because it is a strong, widely used baseline that:

- works well with sparse feedback (likes, watchlist, ratings, dwell)
- is inexpensive to train compared to deep models
- provides embeddings for both users and items (useful for retrieval)

### How it fits MoviNesta

1) Export interactions from Supabase

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  node scripts/recsys/export_interactions.mjs --days 120 --out ./tmp/media_events_120d.jsonl
```

2) Train ALS

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt

python ml/als/train_als.py \
  --events ./tmp/media_events_120d.jsonl \
  --out ./tmp/als_model.npz \
  --factors 64 --iters 20 --reg 0.06
```

3) Publish recommendations back to Supabase (`public.cf_recos`)

```bash
python ml/als/publish_cf_recos.py \
  --events ./tmp/media_events_120d.jsonl \
  --model ./tmp/als_model.npz \
  --k 200 --model_version als_v1
```

## Notes

- These scripts are intentionally conservative and dependency-light.
- The ALS job uses a simple positive-signal definition aligned with the offline eval scripts.
- You can later swap in a learned ranker, sequence model, or multimodal retrieval without changing the publish interface.
