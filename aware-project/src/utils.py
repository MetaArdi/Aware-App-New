# src/utils.py
# AWARE — Utility functions: logging, metrics, TensorBoard, checkpoints, viz

import os
import sys
import json
import logging
import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import tensorflow as tf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from configs.config import (
    LOGS_DIR, CHECKPOINTS_DIR, EXPORTS_DIR,
    TARGET_ACCURACY, TARGET_MAE, CLASS_NAMES
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────
# LOGGING SETUP
# ─────────────────────────────────────────────────────────
def setup_logging(log_level: str = "INFO",
                  log_file: Optional[str] = None) -> None:
    """Configure root logger with console + optional file handler."""
    level = getattr(logging, log_level.upper(), logging.INFO)

    handlers: List[logging.Handler] = [
        logging.StreamHandler()
    ]
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))

    logging.basicConfig(
        level   = level,
        format  = "%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
        datefmt = "%Y-%m-%d %H:%M:%S",
        handlers= handlers,
        force   = True,
    )
    logging.getLogger("tensorflow").setLevel(logging.WARNING)
    logging.getLogger("absl").setLevel(logging.WARNING)


# ─────────────────────────────────────────────────────────
# GPU / DEVICE DETECTION
# ─────────────────────────────────────────────────────────
def configure_device(mixed_precision: bool = True) -> str:
    """
    Detect GPU/CPU and optionally enable mixed precision (fp16).
    Returns device string for logging.
    """
    gpus = tf.config.list_physical_devices("GPU")
    device_str = "CPU"

    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            device_str = f"GPU x{len(gpus)}"
            logger.info(f"GPU tersedia: {gpus}")

            if mixed_precision:
                tf.keras.mixed_precision.set_global_policy("mixed_float16")
                logger.info("Mixed Precision (float16) diaktifkan ✓")
        except RuntimeError as e:
            logger.warning(f"GPU config error: {e}")
    else:
        logger.info("Tidak ada GPU terdeteksi — menggunakan CPU.")
        # Disable mixed precision on CPU (no benefit, adds overhead)
        tf.keras.mixed_precision.set_global_policy("float32")

    return device_str


# ─────────────────────────────────────────────────────────
# TENSORBOARD
# ─────────────────────────────────────────────────────────
def get_tensorboard_writer(experiment_name: str = "aware") -> Tuple[tf.summary.SummaryWriter,
                                                                     tf.summary.SummaryWriter,
                                                                     str]:
    """
    Create TensorBoard SummaryWriters for train and validation.
    Returns (train_writer, val_writer, log_dir_str).
    """
    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    log_dir   = Path(LOGS_DIR) / "tensorboard" / f"{experiment_name}_{timestamp}"

    train_writer = tf.summary.create_file_writer(str(log_dir / "train"))
    val_writer   = tf.summary.create_file_writer(str(log_dir / "val"))

    logger.info(f"TensorBoard logs → {log_dir}")
    logger.info(f"Jalankan: tensorboard --logdir {log_dir}")
    return train_writer, val_writer, str(log_dir)


def log_scalar(writer: tf.summary.SummaryWriter,
               tag: str, value: float, step: int) -> None:
    with writer.as_default():
        tf.summary.scalar(tag, value, step=step)
        writer.flush()


def log_scalars(writer: tf.summary.SummaryWriter,
                metrics: Dict[str, float], step: int) -> None:
    with writer.as_default():
        for tag, value in metrics.items():
            tf.summary.scalar(tag, value, step=step)
        writer.flush()


# ─────────────────────────────────────────────────────────
# METRICS
# ─────────────────────────────────────────────────────────
def compute_metrics(y_true: np.ndarray,
                    y_pred_prob: np.ndarray,
                    threshold: float = 0.5) -> Dict[str, float]:
    """
    Compute accuracy, MAE, precision, recall, F1.
    y_pred_prob : probability for class 1 (fatigue), shape (N,)
    """
    y_true = np.array(y_true, dtype=np.float32).flatten()
    y_prob = np.array(y_pred_prob, dtype=np.float32).flatten()
    y_pred = (y_prob >= threshold).astype(np.float32)

    accuracy  = np.mean(y_pred == y_true)
    mae       = np.mean(np.abs(y_prob - y_true))

    tp = np.sum((y_pred == 1) & (y_true == 1))
    fp = np.sum((y_pred == 1) & (y_true == 0))
    fn = np.sum((y_pred == 0) & (y_true == 1))

    precision = tp / (tp + fp + 1e-9)
    recall    = tp / (tp + fn + 1e-9)
    f1        = 2 * precision * recall / (precision + recall + 1e-9)

    return {
        "accuracy":  float(accuracy),
        "mae":       float(mae),
        "precision": float(precision),
        "recall":    float(recall),
        "f1_score":  float(f1),
    }


def check_performance_targets(metrics: Dict[str, float]) -> bool:
    """Check if model meets the tugas requirements."""
    ok_acc = metrics.get("accuracy", 0) >= TARGET_ACCURACY
    ok_mae = metrics.get("mae", 1.0)    <= TARGET_MAE

    logger.info("=" * 55)
    logger.info("  PERFORMANCE TARGET CHECK")
    logger.info("=" * 55)
    logger.info(f"  Accuracy : {metrics.get('accuracy', 0):.4f}  "
                f"(target ≥ {TARGET_ACCURACY})  {'✅' if ok_acc else '❌'}")
    logger.info(f"  MAE      : {metrics.get('mae', 1.0):.4f}  "
                f"(target ≤ {TARGET_MAE})   {'✅' if ok_mae else '❌'}")
    logger.info(f"  F1-Score : {metrics.get('f1_score', 0):.4f}")
    logger.info(f"  Precision: {metrics.get('precision', 0):.4f}")
    logger.info(f"  Recall   : {metrics.get('recall', 0):.4f}")

    if ok_acc and ok_mae:
        logger.info("  🎯 SEMUA TARGET TERCAPAI!")
    else:
        logger.warning("  ⚠ Belum memenuhi semua target — pertimbangkan tuning lebih lanjut.")
    logger.info("=" * 55)
    return ok_acc and ok_mae


# ─────────────────────────────────────────────────────────
# CHECKPOINT MANAGER
# ─────────────────────────────────────────────────────────
class BestCheckpointManager:
    """
    Tracks best validation accuracy and saves model accordingly.
    Equivalent of keras ModelCheckpoint but compatible with custom loop.
    """

    def __init__(self, model: tf.keras.Model,
                 ckpt_dir: str = CHECKPOINTS_DIR,
                 monitor: str = "val_accuracy",
                 mode: str = "max"):
        self.model    = model
        self.ckpt_dir = Path(ckpt_dir)
        self.ckpt_dir.mkdir(parents=True, exist_ok=True)
        self.monitor  = monitor
        self.best     = -np.inf if mode == "max" else np.inf
        self.mode     = mode
        self.best_path = str(self.ckpt_dir / "best_model.weights.h5")
        self.meta_path = str(self.ckpt_dir / "best_meta.json")

    def update(self, metrics: Dict[str, float], epoch: int) -> bool:
        """Save if monitored metric improved. Returns True if saved."""
        value = metrics.get(self.monitor, None)
        if value is None:
            return False

        improved = (self.mode == "max" and value > self.best) or \
                   (self.mode == "min" and value < self.best)

        if improved:
            self.best = value
            self.model.save_weights(self.best_path)
            meta = {"epoch": epoch, self.monitor: float(value), **metrics}
            with open(self.meta_path, "w") as f:
                json.dump(meta, f, indent=2)
            logger.info(f"  ✓ Best checkpoint saved (epoch {epoch+1}, {self.monitor}={value:.4f})")
            return True
        return False

    def restore_best(self):
        if Path(self.best_path).exists():
            self.model.load_weights(self.best_path)
            logger.info(f"Best weights restored from: {self.best_path}")
        else:
            logger.warning("No checkpoint found to restore.")


# ─────────────────────────────────────────────────────────
# EXPERIMENT TRACKING (simple JSON log)
# ─────────────────────────────────────────────────────────
class ExperimentTracker:
    """
    Lightweight experiment tracker — logs each epoch to a JSON file.
    No external dependency (MLFlow / W&B not required).
    """

    def __init__(self, experiment_name: str = "aware_fatigue"):
        log_dir  = Path(LOGS_DIR) / "experiments"
        log_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_path = log_dir / f"{experiment_name}_{timestamp}.json"
        self.history: List[Dict] = []
        logger.info(f"Experiment log → {self.log_path}")

    def log_epoch(self, epoch: int, metrics: Dict) -> None:
        entry = {"epoch": epoch, **metrics}
        self.history.append(entry)
        with open(self.log_path, "w") as f:
            json.dump(self.history, f, indent=2)

    def get_best(self, metric: str = "val_accuracy") -> Optional[Dict]:
        if not self.history:
            return None
        return max(self.history, key=lambda x: x.get(metric, -1))


# ─────────────────────────────────────────────────────────
# LEARNING RATE SCHEDULER
# ─────────────────────────────────────────────────────────
class WarmupCosineDecay(tf.keras.optimizers.schedules.LearningRateSchedule):
    """
    Warmup for `warmup_steps` then cosine decay to `min_lr`.
    """

    def __init__(self, initial_lr: float, decay_steps: int,
                 warmup_steps: int = 500, min_lr: float = 1e-7):
        super().__init__()
        self.initial_lr   = initial_lr
        self.decay_steps  = decay_steps
        self.warmup_steps = warmup_steps
        self.min_lr       = min_lr

    def __call__(self, step):
        step = tf.cast(step, tf.float32)
        ws   = tf.cast(self.warmup_steps, tf.float32)
        ds   = tf.cast(self.decay_steps,  tf.float32)

        # Warmup phase
        warmup_lr = self.initial_lr * (step / ws)

        # Cosine decay phase
        cosine_lr = self.min_lr + 0.5 * (self.initial_lr - self.min_lr) * (
            1 + tf.cos(np.pi * (step - ws) / (ds - ws))
        )

        return tf.where(step < ws, warmup_lr, cosine_lr)

    def get_config(self):
        return {
            "initial_lr":   self.initial_lr,
            "decay_steps":  self.decay_steps,
            "warmup_steps": self.warmup_steps,
            "min_lr":       self.min_lr,
        }


# ─────────────────────────────────────────────────────────
# EARLY STOPPING (for custom training loop)
# ─────────────────────────────────────────────────────────
class EarlyStoppingCallback:
    """Manual early stopping compatible with custom train loop."""

    def __init__(self, patience: int = 7, monitor: str = "val_accuracy",
                 mode: str = "max", min_delta: float = 1e-4):
        self.patience  = patience
        self.monitor   = monitor
        self.mode      = mode
        self.min_delta = min_delta
        self.best      = -np.inf if mode == "max" else np.inf
        self.counter   = 0
        self.stopped   = False

    def update(self, metrics: Dict[str, float]) -> bool:
        """Returns True if training should stop."""
        value = metrics.get(self.monitor, None)
        if value is None:
            return False

        improved = (
            (self.mode == "max" and value > self.best + self.min_delta) or
            (self.mode == "min" and value < self.best - self.min_delta)
        )

        if improved:
            self.best    = value
            self.counter = 0
        else:
            self.counter += 1
            logger.info(f"  EarlyStopping: {self.counter}/{self.patience} "
                        f"({self.monitor}={value:.4f}, best={self.best:.4f})")

        if self.counter >= self.patience:
            self.stopped = True
            logger.info(f"  ⏹  Early stopping triggered after {self.patience} epochs with no improvement.")
            return True
        return False


# ─────────────────────────────────────────────────────────
# DIRECTORY SETUP
# ─────────────────────────────────────────────────────────
def ensure_directories():
    """Create all required project directories."""
    for d in [LOGS_DIR, CHECKPOINTS_DIR, EXPORTS_DIR,
              Path(LOGS_DIR) / "tensorboard",
              Path(LOGS_DIR) / "experiments"]:
        Path(d).mkdir(parents=True, exist_ok=True)
    logger.info("Project directories ensured ✓")
