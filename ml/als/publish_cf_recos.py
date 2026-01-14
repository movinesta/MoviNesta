from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple

import numpy as np
from tqdm import tqdm


POSITIVE_TYPES = {"like", "watchlist"}


def is_positive(ev: dict) -> bool:
    t = str(ev.get("event_type") or "").strip()
    if t in POSITIVE_TYPES:
        return True
    r = ev.get("rating_0_10")
    if r is not None:
        try:
            n = float(r)
            if math.isfinite(n) and n >= 7:
                return True
        except Exception:
            pass
    return False


def load_events_jsonl(path: Path) -> List[dict]:
    out: List[dict] = []
    with path.open("r", encoding="utf8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except Exception:
                continue
    return out


def load_model_npz(path: Path) -> Tuple[np.ndarray, np.ndarray, List[str], List[str]]:
    z = np.load(path, allow_pickle=True)
    user_factors = z["user_factors"].astype(np.float32)
    item_factors = z["item_factors"].astype(np.float32)
    users = [str(x) for x in z["users"].tolist()]
    items = [str(x) for x in z["items"].tolist()]
    return user_factors, item_factors, users, items


def build_seen_sets(events: List[dict]) -> Dict[str, Set[str]]:
    seen: Dict[str, Set[str]] = {}
    for ev in events:
        if not is_positive(ev):
            continue
        u = str(ev.get("user_id") or "").strip()
        it = str(ev.get("media_item_id") or "").strip()
        if not u or not it:
            continue
        s = seen.setdefault(u, set())
        s.add(it)
    return seen


def topk_recs(
    user_factors: np.ndarray,
    item_factors: np.ndarray,
    users: List[str],
    items: List[str],
    seen: Dict[str, Set[str]],
    k: int,
) -> List[dict]:
    # Pre-normalize item factors for cosine-like scoring, improves stability.
    item_norm = np.linalg.norm(item_factors, axis=1) + 1e-8
    item_unit = item_factors / item_norm[:, None]

    rows: List[dict] = []
    item_ids = np.array(items, dtype=object)

    for u_idx, u_id in enumerate(tqdm(users, desc="Generating recos")):
        uvec = user_factors[u_idx]
        u_norm = np.linalg.norm(uvec) + 1e-8
        u_unit = uvec / u_norm
        scores = item_unit @ u_unit
        # Exclude seen items
        seen_set = seen.get(u_id) or set()
        if seen_set:
            mask = np.isin(item_ids, np.array(list(seen_set), dtype=object))
            scores = scores.copy()
            scores[mask] = -1e9

        top_idx = np.argpartition(-scores, kth=min(k, len(scores) - 1))[:k]
        top_idx = top_idx[np.argsort(-scores[top_idx])]

        for rank, i_idx in enumerate(top_idx.tolist()):
            rows.append(
                {
                    "user_id": u_id,
                    "media_item_id": str(items[i_idx]),
                    "score": float(scores[i_idx]),
                    "rank": int(rank),
                }
            )

    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--events", required=True, help="Path to media_events JSONL")
    ap.add_argument("--model", required=True, help="Path to ALS model .npz")
    ap.add_argument("--k", type=int, default=200)
    ap.add_argument("--model_version", default="als_v1")
    args = ap.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")

    try:
        from supabase import create_client
    except Exception as e:
        raise RuntimeError("Missing dependency 'supabase'. Install with: pip install -r ml/requirements.txt") from e

    events = load_events_jsonl(Path(args.events))
    seen = build_seen_sets(events)
    user_factors, item_factors, users, items = load_model_npz(Path(args.model))
    rows = topk_recs(user_factors, item_factors, users, items, seen, int(args.k))

    client = create_client(supabase_url, service_key)

    # Upsert in manageable batches.
    BATCH = 2000
    total = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        payload = [
            {
                "user_id": r["user_id"],
                "media_item_id": r["media_item_id"],
                "score": r["score"],
                "rank": r["rank"],
                "model_version": str(args.model_version),
            }
            for r in chunk
        ]
        res = client.table("cf_recos").upsert(payload, on_conflict="user_id,media_item_id,model_version").execute()
        if getattr(res, "error", None):
            raise RuntimeError(str(res.error))
        total += len(chunk)

    print(f"Published {total} rows to public.cf_recos (model_version={args.model_version})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
