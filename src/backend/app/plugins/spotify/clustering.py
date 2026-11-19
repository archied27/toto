from collections import defaultdict
from datetime import datetime
from typing import Any

import numpy as np
from hdbscan import HDBSCAN, membership_vector
from sklearn.preprocessing import MultiLabelBinarizer, StandardScaler


def _year(value: str | None) -> int:
    try:
        return datetime.fromisoformat((value or "")[:10]).year
    except ValueError:
        try:
            return int((value or "")[:4])
        except ValueError:
            return 0


def cluster_albums(albums: list[dict[str, Any]]) -> dict[str, int]:
    if not albums:
        return {}
    if len(albums) < 3:
        return {album["id"]: 0 for album in albums}

    genres = MultiLabelBinarizer()
    genre_matrix = genres.fit_transform([album.get("genres", []) for album in albums])
    numeric = np.array([
        [album.get("popularity", 0), _year(album.get("release_date")), album.get("avg_duration", 0)]
        for album in albums
    ], dtype=float)
    features = np.concatenate([StandardScaler().fit_transform(numeric), genre_matrix], axis=1)
    min_cluster_size = max(2, min(10, len(albums) // 10 or 2))
    min_samples = min(3, len(albums) - 1)
    clusterer = HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        cluster_selection_method="leaf",
        prediction_data=True,
    )
    labels = clusterer.fit_predict(features)

    noise = labels == -1
    if noise.any() and len(albums) > 2 * min_samples:
        soft = membership_vector(clusterer, features[noise])
        if soft.size:
            best = np.argmax(soft, axis=1)
            probability = soft[np.arange(len(soft)), best]
            noise_indices = np.where(noise)[0]
            labels[noise_indices[probability >= 0.035]] = best[probability >= 0.035]

    return {album["id"]: int(label) for album, label in zip(albums, labels)}


def grouped_albums(albums: list[dict[str, Any]], names: dict[int, str] | None = None) -> list[dict[str, Any]]:
    groups = defaultdict(list)
    for album in albums:
        groups[album["cluster"]].append(album)
    names = names or {}
    return [
        {
            "id": cluster_id,
            "name": names.get(cluster_id, f"Cluster {cluster_id + 1}" if cluster_id >= 0 else "Unsorted"),
            "count": len(items),
            "cover_image": items[0].get("cover_image"),
        }
        for cluster_id, items in sorted(groups.items(), key=lambda item: item[0])
    ]