# main.py
# AWARE — Entry Point
# Run: python main.py           (full pipeline)
#      python main.py --inspect (inspect dataset only)
#      python main.py --train   (train only)
#      python main.py --eval    (evaluate only)

import sys
import argparse
import logging
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from src.utils import setup_logging, ensure_directories, configure_device


def main():
    parser = argparse.ArgumentParser(
        description="AWARE: AI-Based Workplace Assessment for Readiness and Safety"
    )
    parser.add_argument("--inspect", action="store_true",
                        help="Inspect dataset only (no training)")
    parser.add_argument("--train",   action="store_true",
                        help="Run full training pipeline")
    parser.add_argument("--eval",    action="store_true",
                        help="Evaluate exported model on test set")
    parser.add_argument("--clean",   action="store_true",
                        help="Clean dataset (remove duplicates & corrupt)")
    args = parser.parse_args()

    # Default: run full pipeline
    run_full = not any([args.inspect, args.train, args.eval, args.clean])

    from configs.config import LOGS_DIR, MIXED_PRECISION
    log_file = str(Path(LOGS_DIR) / "main.log")
    setup_logging("INFO", log_file=log_file)
    logger = logging.getLogger(__name__)

    logger.info("=" * 55)
    logger.info("  AWARE — Fatigue Detection System")
    logger.info("  Team CC26-PRU440 | Coding Camp 2026")
    logger.info("=" * 55)

    ensure_directories()
    device = configure_device(mixed_precision=MIXED_PRECISION)
    logger.info(f"  Running on: {device}")

    # ── INSPECT ────────────────────────────────────────────
    if args.inspect or run_full:
        from src.dataset import extract_dataset, inspect_dataset
        root = extract_dataset()
        inspect_dataset(root)

    # ── CLEAN ──────────────────────────────────────────────
    if args.clean:
        from src.dataset import extract_dataset, clean_dataset
        root = extract_dataset()
        clean_dataset(root)
        logger.info("Dataset cleaning selesai.")

    # ── TRAIN ──────────────────────────────────────────────
    if args.train or run_full:
        logger.info("\nMemulai training pipeline ...")
        from train import main as train_main
        train_main()

    # ── EVAL ───────────────────────────────────────────────
    if args.eval:
        logger.info("\nMelakukan evaluasi model ...")
        from configs.config import (
            MODEL_KERAS_PATH, BATCH_SIZE
        )
        from src.dataset import (
            extract_dataset, prepare_labels, split_dataset, build_pipeline
        )
        from train import evaluate_model
        import tensorflow as tf

        root         = extract_dataset()
        paths, labels = prepare_labels(root)
        _, _, te      = split_dataset(paths, labels)
        ds_test       = build_pipeline(te[0], te[1],
                                       augment=False, shuffle=False,
                                       batch_size=BATCH_SIZE)
        model = tf.keras.models.load_model(MODEL_KERAS_PATH)
        evaluate_model(model, ds_test)

    logger.info("\n✅  AWARE pipeline selesai.")


if __name__ == "__main__":
    main()
