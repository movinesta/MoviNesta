#!/usr/bin/env python3
"""
publish_cf_recos.py

Publishes Top-K collaborative-filtering recommendations (ALS) into Supabase table `public.cf_recos`.

Fixes common ALS npz serialization issues:
- factors saved transposed (n_factors, n_entities) instead of (n_entities, n_factors)
- users/items ids stored under different keys (users/user_ids, items/item_ids)
- user_factors and item_factors accidentally swapped

Usage:
  python ml/als/publish_cf_recos.py \
    --events ml/data/media_events.jsonl \
    --model ml/data/als_model.npz \
    --model_version als_v1 \
    --k 200
"""
from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

import numpy as np
from tqdm import tqdm

try:
    from supabase import create_client  # type: ignore
except Exception:
    create_client = None  # handled in main()


@dataclass(frozen=True)
class Event:
    user_id: str
    media_item_id: str
    event_type: str


POSITIVE_EVENTS: Set[str] = {"like", "more_like_this", "watchlist_add", "rating_set"}


def read_events_jsonl(path: Path) -> List[Event]:
    events: List[Event] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            # tolerate multiple schemas
            user_id = str(obj.get("user_id") or obj.get("user") or obj.get("uid") or "").strip()
            item_id = str(obj.get("media_item_id") or obj.get("item_id") or obj.get("mediaId") or "").strip()
            event_type = str(obj.get("event_type") or obj.get("type") or "").strip()
            if not user_id or not item_id or not event_type:
                continue
            events.append(Event(user_id=user_id, media_item_id=item_id, event_type=event_type))
    return events


def _pick_first_existing(arr: np.lib.npyio.NpzFile, keys: Sequence[str]) -> Optional[np.ndarray]:
    for k in keys:
        if k in arr.files:
            return arr[k]
    return None


def _as_str_list(x: np.ndarray) -> List[str]:
    # npz may store dtype=object, bytes, or numeric
    if x is None:
        return []
    x = np.asarray(x)
    if x.dtype.kind in {"S", "a"}:
        return [v.decode("utf-8", "ignore") for v in x.tolist()]
    return [str(v) for v in x.tolist()]


def _ensure_rows_first(mat: np.ndarray, n_expected: int, name: str) -> np.ndarray:
    """Ensure matrix is shaped (n_entities, n_factors) rather than transposed."""
    mat = np.asarray(mat)
    if mat.ndim != 2:
        raise ValueError(f"{name} must be 2D, got shape {mat.shape}")
    r, c = mat.shape
    if r == n_expected:
        return mat
    if c == n_expected:
        return mat.T
    return mat  # leave as-is; later we will attempt swap heuristic / raise


def load_model_npz(path: Path) -> Tuple[np.ndarray, np.ndarray, List[str], List[str]]:
    """
    Loads model factors and ids from a .npz file.

    Returns:
      user_factors: (n_users, n_factors)
      item_factors: (n_items, n_factors)
      users: list[str] length n_users
      items: list[str] length n_items
    """
    arr = np.load(path, allow_pickle=True)

    user_factors = _pick_first_existing(arr, ["user_factors", "U", "user_emb", "user_embeddings"])
    item_factors = _pick_first_existing(arr, ["item_factors", "V", "item_emb", "item_embeddings"])

    if user_factors is None or item_factors is None:
        raise ValueError(
            f"Model npz must contain user_factors and item_factors (or aliases). Found keys: {arr.files}"
        )

    users_raw = _pick_first_existing(arr, ["users", "user_ids", "uids"])
    items_raw = _pick_first_existing(arr, ["items", "item_ids", "iids"])

    users = _as_str_list(users_raw) if users_raw is not None else []
    items = _as_str_list(items_raw) if items_raw is not None else []

    # If ids missing, infer sizes later; but we still need something stable for publishing.
    # In that case, we will publish using index-based ids which is not ideal.
    if not users:
        users = [str(i) for i in range(int(np.asarray(user_factors).shape[0]))]
    if not items:
        items = [str(i) for i in range(int(np.asarray(item_factors).shape[0]))]

    # First fix: transpose factors if saved with rows/cols swapped
    user_factors = _ensure_rows_first(np.asarray(user_factors), len(users), "user_factors")
    item_factors = _ensure_rows_first(np.asarray(item_factors), len(items), "item_factors")

    # Second fix: sometimes user/item factors are accidentally swapped in the npz
    # Heuristic: if user_factors rows match items length AND item_factors rows match users length, swap them.
    if user_factors.shape[0] != len(users) and item_factors.shape[0] != len(items):
        if user_factors.shape[0] == len(items) and item_factors.shape[0] == len(users):
            user_factors, item_factors = item_factors, user_factors

    # Final validation
    if user_factors.shape[0] != len(users):
        raise ValueError(
            f"user_factors shape {user_factors.shape} does not match users length {len(users)} "
            f"(npz keys: {arr.files})"
        )
    if item_factors.shape[0] != len(items):
        raise ValueError(
            f"item_factors shape {item_factors.shape} does not match items length {len(items)} "
            f"(npz keys: {arr.files})"
        )
    if user_factors.shape[1] != item_factors.shape[1]:
        raise ValueError(
            f"Factor dimension mismatch: user_factors {user_factors.shape}, item_factors {item_factors.shape}"
        )

    return user_factors.astype(np.float32), item_factors.astype(np.float32), users, items


def build_seen_map(events: Sequence[Event]) -> Dict[str, Set[str]]:
    seen: Dict[str, Set[str]] = {}
    for e in events:
        if e.user_id not in seen:
            seen[e.user_id] = set()
        seen[e.user_id].add(e.media_item_id)
    return seen


def topk_recs(
    user_factors: np.ndarray,
    item_factors: np.ndarray,
    users: Sequence[str],
    items: Sequence[str],
    seen: Dict[str, Set[str]],
    k: int,
) -> List[Dict]:
    """
    Compute top-k dot-product recommendations per user, excluding already-seen items.
    """
    item_factors_t = item_factors.T  # (n_factors, n_items)
    item_index: Dict[str, int] = {iid: j for j, iid in enumerate(items)}

    out_rows: List[Dict] = []
    for ui, uid in enumerate(tqdm(users, desc="Generating recos")):
        u = user_factors[ui]  # (n_factors,)
        scores = u @ item_factors_t  # (n_items,)

        # Exclude seen items for this user (mask over items axis)
        if uid in seen and seen[uid]:
            mask = np.zeros(scores.shape[0], dtype=bool)  # len(items)
            for iid in seen[uid]:
                j = item_index.get(iid)
                if j is not None:
                    mask[j] = True
            scores[mask] = -1e9

        # Top-k indices
        kk = min(int(k), scores.shape[0])
        if kk <= 0:
            continue
        # argpartition for speed, then sort those
        top = np.argpartition(-scores, kk - 1)[:kk]
        top = top[np.argsort(-scores[top])]

        for rank, j in enumerate(top, start=1):
            out_rows.append(
                {
                    "user_id": uid,
                    "media_item_id": items[int(j)],
                    "model_version": None,  # filled in main
                    "rank": int(rank),
                    "score": float(scores[int(j)]),
                }
            )
    return out_rows


def publish_to_supabase(rows: List[Dict], supabase_url: str, service_role_key: str) -> None:
    if create_client is None:
        raise RuntimeError("supabase-py is not installed in this environment.")
    sb = create_client(supabase_url, service_role_key)

    # Upsert in chunks
    CHUNK = 1000
    for i in tqdm(range(0, len(rows), CHUNK), desc="Upserting cf_recos"):
        chunk = rows[i : i + CHUNK]
        # public.cf_recos PK: (user_id, media_item_id, model_version)
        res = sb.table("cf_recos").upsert(chunk, on_conflict="user_id,media_item_id,model_version").execute()
        if getattr(res, "error", None):
            raise RuntimeError(f"Supabase upsert error: {res.error}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--events", required=True, help="Path to media_events.jsonl")
    ap.add_argument("--model", required=True, help="Path to als_model.npz")
    ap.add_argument("--model_version", required=True, help="Model version string to store (e.g. als_v1)")
    ap.add_argument("--k", type=int, default=200, help="Top-k per user")
    ap.add_argument("--dry_run", action="store_true", help="Compute rows but do not publish to Supabase")
    args = ap.parse_args()

    events_path = Path(args.events)
    model_path = Path(args.model)

    events = read_events_jsonl(events_path)
    if not events:
        raise SystemExit(f"No events read from {events_path}")

    # Use positives to define seen (exclude all interactions to avoid repeats)
    seen = build_seen_map(events)

    user_factors, item_factors, users, items = load_model_npz(model_path)

    # Filter users to those that exist in model ids (intersection)
    # (events may include users not in model; ignore them here)
    users_in_events = {e.user_id for e in events}
    users_filtered = [u for u in users if u in users_in_events]
    if not users_filtered:
        # Fall back to all model users if events ids don't match (but still safe)
        users_filtered = list(users)

    rows = topk_recs(user_factors, item_factors, users_filtered, items, seen, int(args.k))
    for r in rows:
        r["model_version"] = args.model_version

    print(f"Prepared {len(rows)} recommendations rows (users={len(users_filtered)}, items={len(items)})")

    if args.dry_run:
        return 0

    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("SUPABASE_PROJECT_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise SystemExit("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY environment variables.")

    publish_to_supabase(rows, supabase_url, service_role_key)
    print("✅ Published cf_recos successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
