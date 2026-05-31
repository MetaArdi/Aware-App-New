# infer.py
# AWARE — Inference Script
# Run: python infer.py --image path/to/image.jpg
#      python infer.py --folder path/to/folder/
#      python infer.py --webcam          (optional, requires opencv)

import sys
import argparse
import logging
from pathlib import Path

import numpy as np
import tensorflow as tf

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from configs.config import (
    IMG_SIZE, CLASS_NAMES, MODEL_KERAS_PATH, MODEL_SAVEDMODEL_PATH
)
from src.utils import setup_logging

logger = logging.getLogger(__name__)

VALID_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


# ─────────────────────────────────────────────────────────
# LOAD MODEL
# ─────────────────────────────────────────────────────────
def load_model(model_path: str = MODEL_KERAS_PATH) -> tf.keras.Model:
    """Load exported model (.keras or SavedModel)."""
    path = Path(model_path)
    if not path.exists():
        raise FileNotFoundError(
            f"Model tidak ditemukan: {path}\n"
            "Jalankan `python train.py` terlebih dahulu."
        )
    logger.info(f"Loading model from: {path}")
    model = tf.keras.models.load_model(str(path))
    logger.info("Model loaded ✓")
    return model


# ─────────────────────────────────────────────────────────
# PREPROCESS
# ─────────────────────────────────────────────────────────
def preprocess_image(image_path: str,
                     img_size: tuple = IMG_SIZE) -> tf.Tensor:
    """Read and preprocess a single image for inference."""
    raw   = tf.io.read_file(image_path)
    image = tf.image.decode_image(raw, channels=3, expand_animations=False)
    image = tf.image.resize(image, img_size)
    image = tf.cast(image, tf.float32) / 255.0
    return tf.expand_dims(image, 0)   # add batch dim


# ─────────────────────────────────────────────────────────
# PREDICT SAMPLE (single image)
# ─────────────────────────────────────────────────────────
def predict_sample(model: tf.keras.Model,
                   image_path: str,
                   threshold: float = 0.5) -> dict:
    """
    Run inference on a single image.

    Returns dict with:
        - image_path
        - fatigue_probability (float)
        - prediction (str: "alert" or "fatigue")
        - confidence (float)
        - risk_level (str: Low / Medium / High)
    """
    tensor = preprocess_image(image_path)
    logit  = model(tensor, training=False)
    prob   = float(tf.sigmoid(tf.cast(logit, tf.float32)).numpy().flatten()[0])

    pred = "fatigue" if prob >= threshold else "alert"

    # Risk scoring
    if prob < 0.35:
        risk = "Low"
    elif prob < 0.65:
        risk = "Medium"
    else:
        risk = "High"

    confidence = prob if pred == "fatigue" else (1 - prob)

    result = {
        "image_path":         image_path,
        "fatigue_probability": round(prob, 4),
        "prediction":          pred,
        "confidence":          round(confidence, 4),
        "risk_level":          risk,
        "fit_to_work":         "✅ FIT" if pred == "alert" else "⚠️  NOT FIT",
    }
    return result


# ─────────────────────────────────────────────────────────
# BATCH INFERENCE
# ─────────────────────────────────────────────────────────
def predict_folder(model: tf.keras.Model,
                   folder_path: str,
                   threshold: float = 0.5) -> list:
    """Run inference on all images in a folder."""
    folder  = Path(folder_path)
    images  = [p for p in folder.rglob("*") if p.suffix.lower() in VALID_EXT]

    if not images:
        logger.warning(f"Tidak ada gambar ditemukan di: {folder}")
        return []

    logger.info(f"Inferring {len(images)} images ...")
    results = []

    # Batch processing
    batch_paths  = []
    batch_tensors = []

    for img_path in images:
        try:
            t = preprocess_image(str(img_path))
            batch_tensors.append(t)
            batch_paths.append(str(img_path))
        except Exception as e:
            logger.warning(f"Gagal baca {img_path}: {e}")

    if not batch_tensors:
        return []

    # Stack and predict
    batch  = tf.concat(batch_tensors, axis=0)
    logits = model(batch, training=False)
    probs  = tf.sigmoid(tf.cast(logits, tf.float32)).numpy().flatten()

    for path, prob in zip(batch_paths, probs):
        prob  = float(prob)
        pred  = "fatigue" if prob >= threshold else "alert"
        risk  = "High" if prob >= 0.65 else ("Medium" if prob >= 0.35 else "Low")
        conf  = prob if pred == "fatigue" else (1 - prob)
        results.append({
            "image_path":          path,
            "fatigue_probability": round(prob, 4),
            "prediction":          pred,
            "confidence":          round(conf, 4),
            "risk_level":          risk,
        })

    # Summary
    n_fatigue = sum(1 for r in results if r["prediction"] == "fatigue")
    logger.info(f"Results: {n_fatigue}/{len(results)} classified as fatigue")
    return results


# ─────────────────────────────────────────────────────────
# WEBCAM INFERENCE  (optional)
# ─────────────────────────────────────────────────────────
def predict_webcam(model: tf.keras.Model, threshold: float = 0.5):
    """
    Real-time fatigue detection from webcam.
    Requires: pip install opencv-python
    """
    try:
        import cv2
    except ImportError:
        logger.error("OpenCV tidak terinstall. Jalankan: pip install opencv-python")
        return

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        logger.error("Tidak bisa membuka webcam.")
        return

    logger.info("Webcam terbuka. Tekan 'q' untuk keluar.")
    H, W = IMG_SIZE

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Preprocess frame
        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (W, H))
        tensor  = tf.constant(resized, dtype=tf.float32)[None] / 255.0

        logit = model(tensor, training=False)
        prob  = float(tf.sigmoid(tf.cast(logit, tf.float32)).numpy().flatten()[0])
        pred  = "FATIGUE ⚠️" if prob >= threshold else "ALERT ✅"
        color = (0, 0, 255) if prob >= threshold else (0, 200, 0)

        # Overlay
        cv2.putText(frame, f"{pred}  ({prob:.2f})",
                    (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)

        cv2.imshow("AWARE — Fatigue Detection", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


# ─────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────
def main():
    setup_logging("INFO")

    parser = argparse.ArgumentParser(
        description="AWARE Fatigue Detection — Inference CLI"
    )
    parser.add_argument("--image",   type=str, help="Path to single image file")
    parser.add_argument("--folder",  type=str, help="Path to folder of images")
    parser.add_argument("--webcam",  action="store_true", help="Use webcam")
    parser.add_argument("--model",   type=str, default=MODEL_KERAS_PATH,
                        help="Path to model (.keras or SavedModel dir)")
    parser.add_argument("--threshold", type=float, default=0.5,
                        help="Classification threshold (default: 0.5)")
    args = parser.parse_args()

    model = load_model(args.model)

    if args.image:
        result = predict_sample(model, args.image, args.threshold)
        print("\n" + "=" * 45)
        print("  AWARE — INFERENCE RESULT")
        print("=" * 45)
        for k, v in result.items():
            print(f"  {k:<25}: {v}")
        print("=" * 45)

    elif args.folder:
        results = predict_folder(model, args.folder, args.threshold)
        print(f"\n{'='*55}")
        print(f"  BATCH INFERENCE — {len(results)} images")
        print(f"{'='*55}")
        for r in results[:20]:   # show first 20
            print(f"  [{r['risk_level']:>6}] {r['prediction']:<8} ({r['fatigue_probability']:.2f})  {Path(r['image_path']).name}")
        if len(results) > 20:
            print(f"  ... and {len(results)-20} more")

    elif args.webcam:
        predict_webcam(model, args.threshold)

    else:
        parser.print_help()
        print("\nContoh penggunaan:")
        print("  python infer.py --image foto_karyawan.jpg")
        print("  python infer.py --folder dataset/test/")
        print("  python infer.py --webcam")


if __name__ == "__main__":
    main()
