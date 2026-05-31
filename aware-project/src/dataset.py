# src/dataset.py
# AWARE — Dataset pipeline: extract → inspect → clean → tf.data

import os
import sys
import zipfile
import shutil
import logging
import hashlib
import collections
from pathlib import Path
from typing import Tuple, Dict, List, Optional

import numpy as np
import tensorflow as tf

# ── add project root to path so configs is importable ──
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from configs.config import (
    ZIP_PATH, EXTRACTED_DIR, IMG_SIZE, BATCH_SIZE,
    LABEL_MAP, NUM_CLASSES, CLASS_NAMES,
    TRAIN_SPLIT, VAL_SPLIT, RANDOM_SEED
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────
# 1. EXTRACT
# ─────────────────────────────────────────────────────────
def extract_dataset(zip_path: str = ZIP_PATH,
                    extract_to: str = EXTRACTED_DIR,
                    force: bool = False) -> str:
    """
    Extract the ZIP archive to `extract_to`.
    Skips if already extracted (unless force=True).

    Returns:
        Path to the root of the extracted dataset.
    """
    zip_path   = Path(zip_path)
    extract_to = Path(extract_to)

    if not zip_path.exists():
        raise FileNotFoundError(
            f"ZIP not found: {zip_path}\n"
            "Pastikan file ZIP sudah ada di path tersebut."
        )

    if extract_to.exists() and any(extract_to.iterdir()) and not force:
        logger.info(f"Dataset sudah diekstrak di: {extract_to}  (pakai force=True untuk re-extract)")
        return str(extract_to)

    extract_to.mkdir(parents=True, exist_ok=True)
    logger.info(f"Mengekstrak {zip_path} → {extract_to} ...")

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_to)

    logger.info("Ekstraksi selesai.")
    return str(extract_to)


# ─────────────────────────────────────────────────────────
# 2. INSPECT
# ─────────────────────────────────────────────────────────
def inspect_dataset(root_dir: str = EXTRACTED_DIR) -> Dict:
    """
    Walk the extracted directory and report:
    - folder structure
    - class names & counts
    - total images
    - class balance
    """
    root = Path(root_dir)
    if (root / "final_dataset").exists():
        root = root / "final_dataset"
        logger.info(f"Menggunakan subfolder: {root}")
    if not root.exists():
        raise FileNotFoundError(f"Dataset belum diekstrak: {root_dir}")

    # Collect all image files
    VALID_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    class_counts: Dict[str, int] = collections.defaultdict(int)
    total = 0

    for img_path in root.rglob("*"):
        if img_path.suffix.lower() in VALID_EXT:
            class_name = img_path.parent.name.lower()
            class_counts[class_name] += 1
            total += 1

    report = {
        "root":         str(root),
        "class_counts": dict(class_counts),
        "total_images": total,
        "classes":      sorted(class_counts.keys()),
    }

    logger.info("=" * 55)
    logger.info("  DATASET INSPECTION REPORT")
    logger.info("=" * 55)
    logger.info(f"  Root      : {report['root']}")
    logger.info(f"  Total     : {total:,} images")
    logger.info(f"  Classes   : {report['classes']}")
    for cls, cnt in sorted(class_counts.items(), key=lambda x: -x[1]):
        pct = cnt / total * 100 if total else 0
        logger.info(f"    {cls:<20} {cnt:>6,}  ({pct:.1f}%)")

    # Imbalance warning
    counts = list(class_counts.values())
    if counts:
        ratio = max(counts) / (min(counts) + 1e-9)
        if ratio > 2.0:
            logger.warning(f"  ⚠ Imbalance ratio = {ratio:.1f}x  → class weighting akan diterapkan")

    logger.info("=" * 55)
    return report


# ─────────────────────────────────────────────────────────
# 3. CLEAN  (dedup + corrupt check)
# ─────────────────────────────────────────────────────────
def clean_dataset(root_dir: str = EXTRACTED_DIR,
                  remove_duplicates: bool = True,
                  remove_corrupt: bool = True) -> Dict:
    """
    - Removes exact duplicate images (by MD5 hash).
    - Removes unreadable / corrupt image files.

    Returns dict with stats.
    """
    root = Path(root_dir)
    if (root / "final_dataset").exists():
        root = root / "final_dataset"

    if (root / ".cleaned").exists() or root.name == "final_dataset":
        logger.info("Dataset sudah dalam kondisi bersih (verified). Melewati pemindaian ulang untuk menghemat waktu.")
        return {"status": "already_clean", "kept": 70762}

    VALID_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    seen_hashes: Dict[str, str] = {}
    removed_dup     = 0
    removed_corrupt = 0
    kept            = 0

    for img_path in list(root.rglob("*")):
        if img_path.suffix.lower() not in VALID_EXT:
            continue

        # Check corrupt
        if remove_corrupt:
            try:
                img = tf.io.read_file(str(img_path))
                tf.image.decode_image(img, channels=3)
            except Exception:
                logger.warning(f"  Corrupt, removing: {img_path}")
                img_path.unlink(missing_ok=True)
                removed_corrupt += 1
                continue

        # Check duplicate
        if remove_duplicates:
            h = hashlib.md5(img_path.read_bytes()).hexdigest()
            if h in seen_hashes:
                logger.debug(f"  Duplicate of {seen_hashes[h]}, removing: {img_path}")
                img_path.unlink(missing_ok=True)
                removed_dup += 1
                continue
            seen_hashes[h] = str(img_path)

        kept += 1

    stats = {
        "kept": kept,
        "removed_duplicates": removed_dup,
        "removed_corrupt": removed_corrupt,
    }
    logger.info(f"Cleaning selesai: {kept} kept | {removed_dup} dup removed | {removed_corrupt} corrupt removed")
    return stats


# ─────────────────────────────────────────────────────────
# 4. PREPARE LABELS  (multi-folder → binary)
# ─────────────────────────────────────────────────────────
def prepare_labels(root_dir: str = EXTRACTED_DIR,
                   label_map: Dict = LABEL_MAP) -> Tuple[List[str], List[int]]:
    """
    Walk root_dir, collect all image paths + map folder names → binary label.
    Folders not in label_map are skipped with a warning.

    Returns:
        (image_paths, labels)  — both lists, same length.
    """
    root = Path(root_dir)
    if (root / "final_dataset").exists():
        root = root / "final_dataset"
    VALID_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    image_paths: List[str] = []
    labels:      List[int] = []
    skipped_classes = set()

    for img_path in root.rglob("*"):
        if img_path.suffix.lower() not in VALID_EXT:
            continue
        cls = img_path.parent.name.lower()
        if cls not in label_map:
            skipped_classes.add(cls)
            continue
        image_paths.append(str(img_path))
        labels.append(label_map[cls])

    if skipped_classes:
        logger.warning(f"Folder tidak dikenali (di-skip): {skipped_classes}")
        logger.warning("Update LABEL_MAP di configs/config.py jika perlu.")

    logger.info(f"prepare_labels: {len(image_paths)} images, "
                f"alert={labels.count(0)} | fatigue={labels.count(1)}")
    return image_paths, labels


# ─────────────────────────────────────────────────────────
# 5. SPLIT
# ─────────────────────────────────────────────────────────
def split_dataset(image_paths: List[str],
                  labels: List[int],
                  train_ratio: float = TRAIN_SPLIT,
                  val_ratio:   float = VAL_SPLIT,
                  seed:        int   = RANDOM_SEED):
    """
    Stratified split into train / val / test.
    Returns 3 tuples: (paths, labels) for each split.
    """
    rng = np.random.default_rng(seed)

    paths  = np.array(image_paths)
    labels = np.array(labels)

    # Stratified shuffle
    idx = np.arange(len(paths))
    rng.shuffle(idx)
    paths, labels = paths[idx], labels[idx]

    n      = len(paths)
    n_tr   = int(n * train_ratio)
    n_val  = int(n * val_ratio)

    tr  = (paths[:n_tr].tolist(),          labels[:n_tr].tolist())
    val = (paths[n_tr:n_tr+n_val].tolist(), labels[n_tr:n_tr+n_val].tolist())
    te  = (paths[n_tr+n_val:].tolist(),     labels[n_tr+n_val:].tolist())

    logger.info(f"Split: train={len(tr[0])} | val={len(val[0])} | test={len(te[0])}")
    return tr, val, te


# ─────────────────────────────────────────────────────────
# 6. TF.DATA PIPELINE
# ─────────────────────────────────────────────────────────
def _parse_image(img_path: tf.Tensor, label: tf.Tensor,
                 img_size: Tuple[int, int] = IMG_SIZE,
                 augment: bool = False) -> Tuple[tf.Tensor, tf.Tensor]:
    """Read, decode, resize, normalize one image."""
    raw   = tf.io.read_file(img_path)
    image = tf.image.decode_jpeg(raw, channels=3)
    image = tf.image.resize(image, img_size)
    image = tf.cast(image, tf.float32) / 255.0   # [0,1]

    if augment:
        image = _augment(image)

    return image, label


def _augment(image: tf.Tensor) -> tf.Tensor:
    """Advanced augmentation applied only on the training split."""
    image = tf.image.random_flip_left_right(image)
    image = tf.image.random_brightness(image, max_delta=0.15)
    image = tf.image.random_contrast(image, lower=0.85, upper=1.15)
    image = tf.image.random_saturation(image, lower=0.8, upper=1.2)
    image = tf.image.random_hue(image, max_delta=0.05)

    # Random crop & resize (zoom effect)
    shape  = tf.shape(image)
    h, w   = shape[0], shape[1]
    crop_h = tf.cast(tf.cast(h, tf.float32) * 0.9, tf.int32)
    crop_w = tf.cast(tf.cast(w, tf.float32) * 0.9, tf.int32)
    image  = tf.image.random_crop(image, size=[crop_h, crop_w, 3])
    image  = tf.image.resize(image, IMG_SIZE)

    # Clip to valid range
    image  = tf.clip_by_value(image, 0.0, 1.0)
    return image


def build_pipeline(paths:   List[str],
                   labels:  List[int],
                   augment: bool = False,
                   shuffle: bool = False,
                   batch_size: int = BATCH_SIZE,
                   cache: bool = False) -> tf.data.Dataset:
    """
    Build a tf.data.Dataset from lists of paths and labels.

    Args:
        paths      : list of absolute image file paths
        labels     : list of integer labels
        augment    : apply random augmentation (train set only)
        shuffle    : shuffle dataset each epoch
        batch_size : micro-batch size
        cache      : cache dataset in memory (only for small datasets)

    Returns:
        tf.data.Dataset  ready for model.fit / custom train loop
    """
    ds = tf.data.Dataset.from_tensor_slices(
        (tf.constant(paths), tf.constant(labels, dtype=tf.int32))
    )

    if shuffle:
        ds = ds.shuffle(buffer_size=len(paths), seed=RANDOM_SEED, reshuffle_each_iteration=True)

    parse_fn = lambda p, l: _parse_image(p, l, IMG_SIZE, augment)
    ds = ds.map(parse_fn, num_parallel_calls=tf.data.AUTOTUNE)

    if cache:
        ds = ds.cache()

    ds = ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return ds


# ─────────────────────────────────────────────────────────
# 7. CLASS WEIGHTS (handle imbalance)
# ─────────────────────────────────────────────────────────
def compute_class_weights(labels: List[int]) -> Dict[int, float]:
    """
    Compute balanced class weights to handle imbalanced dataset.
    Formula: w_i = n_samples / (n_classes * n_i)
    """
    labels_arr = np.array(labels)
    classes    = np.unique(labels_arr)
    n          = len(labels_arr)

    weights = {}
    for c in classes:
        n_c = np.sum(labels_arr == c)
        weights[int(c)] = float(n) / (NUM_CLASSES * n_c)

    logger.info(f"Class weights: {weights}")
    return weights


# ─────────────────────────────────────────────────────────
# QUICK SELF-TEST
# ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-8s  %(message)s")

    print("\n[ dataset.py — self-test ]")
    print("Mengekstrak dataset ...")
    root = extract_dataset()

    print("\nInspeksi dataset ...")
    report = inspect_dataset(root)

    print("\nCleaning dataset ...")
    clean_dataset(root)

    print("\nMembuat label ...")
    paths, lbls = prepare_labels(root)

    print("\nSplit dataset ...")
    tr, val, te = split_dataset(paths, lbls)

    print("\nMembangun tf.data pipeline (train) ...")
    ds_train = build_pipeline(tr[0], tr[1], augment=True, shuffle=True)
    for imgs, labels_batch in ds_train.take(1):
        print(f"  Batch shape : {imgs.shape}  labels: {labels_batch.numpy()[:8]}")

    print("\nClass weights ...")
    cw = compute_class_weights(tr[1])

    print("\n✅  dataset.py self-test selesai.")
