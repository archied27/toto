from collections import defaultdict
from datetime import datetime
from typing import Any

import numpy as np
from hdbscan import HDBSCAN, membership_vector
from sklearn.cluster import KMeans
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
        [_year(album.get("release_date")), album.get("avg_duration", 0)]
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

    labels = _split_oversized_clusters(labels, features, albums)

    return {album["id"]: int(label) for album, label in zip(albums, labels)}


def _split_oversized_clusters(labels: np.ndarray, features: np.ndarray, albums: list[dict[str, Any]]) -> np.ndarray:
    if len(labels) == 0:
        return labels

    max_cluster_size = max(25, int(len(labels) * 0.12))
    unique_labels = [label for label in np.unique(labels) if label != -1]
    next_label = max([int(label) for label in unique_labels] + [-1]) + 1

    for cluster_id in unique_labels:
        indices = np.where(labels == cluster_id)[0]
        if len(indices) <= max_cluster_size:
            continue

        split_count = max(2, int(np.ceil(len(indices) / max_cluster_size)))
        split_count = min(split_count, len(indices))
        sub_labels = KMeans(n_clusters=split_count, random_state=42, n_init=10).fit_predict(features[indices])

        for sub_index, sub_label in enumerate(sub_labels):
            if sub_label == 0:
                continue
            labels[indices[sub_index]] = next_label + int(sub_label) - 1
        next_label += split_count - 1

    return labels


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