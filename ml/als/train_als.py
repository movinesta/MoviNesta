from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from scipy.sparse import coo_matrix
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


def build_user_item_matrix(events: List[dict]) -> Tuple[coo_matrix, Dict[str, int], Dict[str, int]]:
    user_index: Dict[str, int] = {}
    item_index: Dict[str, int] = {}

    rows: List[int] = []
    cols: List[int] = []
    data: List[float] = []

    # Implicit ALS expects (items x users) usually; we build users x items and transpose later.
    for ev in tqdm(events, desc="Scanning events"):
        if not is_positive(ev):
            continue
        u = str(ev.get("user_id") or "").strip()
        it = str(ev.get("media_item_id") or "").strip()
        if not u or not it:
            continue

        ui = user_index.setdefault(u, len(user_index))
        ii = item_index.setdefault(it, len(item_index))
        rows.append(ui)
        cols.append(ii)
        # Simple unit weight. You can upgrade later with dwell/rating weights.
        data.append(1.0)

    if not rows:
        raise RuntimeError("No positive events found. Cannot train ALS.")

    mat = coo_matrix((np.array(data, dtype=np.float32), (np.array(rows), np.array(cols))))
    return mat, user_index, item_index


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--events", required=True, help="Path to media_events JSONL")
    ap.add_argument("--out", required=True, help="Output .npz model path")
    ap.add_argument("--factors", type=int, default=64)
    ap.add_argument("--iters", type=int, default=20)
    ap.add_argument("--reg", type=float, default=0.06)
    ap.add_argument("--alpha", type=float, default=20.0, help="Confidence scaling")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    events_path = Path(args.events)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    events = load_events_jsonl(events_path)
    mat_ui, user_index, item_index = build_user_item_matrix(events)

    try:
        from implicit.als import AlternatingLeastSquares
    except Exception as e:
        raise RuntimeError(
            "Missing dependency 'implicit'. Install with: pip install -r ml/requirements.txt"
        ) from e

    np.random.seed(args.seed)

    # implicit expects item-user matrix (items x users)
    mat_iu = mat_ui.T.tocsr() * float(args.alpha)

    model = AlternatingLeastSquares(
        factors=int(args.factors),
        iterations=int(args.iters),
        regularization=float(args.reg),
        random_state=int(args.seed),
    )
    model.fit(mat_iu)

    # Save embeddings and index mappings
    inv_user = np.array([u for u, _ in sorted(user_index.items(), key=lambda x: x[1])], dtype=object)
    inv_item = np.array([it for it, _ in sorted(item_index.items(), key=lambda x: x[1])], dtype=object)

    np.savez_compressed(
        out_path,
        user_factors=model.user_factors.astype(np.float32),
        item_factors=model.item_factors.astype(np.float32),
        users=inv_user,
        items=inv_item,
        meta=np.array(
            [
                {
                    "factors": int(args.factors),
                    "iters": int(args.iters),
                    "reg": float(args.reg),
                    "alpha": float(args.alpha),
                    "seed": int(args.seed),
                }
            ],
            dtype=object,
        ),
    )

    print(f"Saved ALS model -> {out_path}")
    print(f"Users: {len(user_index)} | Items: {len(item_index)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
