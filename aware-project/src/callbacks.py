# src/callbacks.py
# AWARE — Custom Callbacks
# Requirement: Custom Callback ✓

import logging
import time
from typing import Dict, Optional
from pathlib import Path

import tensorflow as tf

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────
# CUSTOM CALLBACK 1 — Training Monitor + TensorBoard
# Requirement: Custom Callback ✓
# ─────────────────────────────────────────────────────────
class AwareTrainingMonitor(tf.keras.callbacks.Callback):
    """
    Custom callback that:
    1. Logs metrics to TensorBoard at each epoch end.
    2. Prints a rich training summary table.
    3. Tracks epoch duration.
    4. Alerts when performance targets are met.
    """

    def __init__(self,
                 train_writer: tf.summary.SummaryWriter,
                 val_writer:   tf.summary.SummaryWriter,
                 target_accuracy: float = 0.85,
                 target_mae:      float = 0.02):
        super().__init__()
        self.train_writer    = train_writer
        self.val_writer      = val_writer
        self.target_accuracy = target_accuracy
        self.target_mae      = target_mae
        self._epoch_start    = 0.0
        self._best_val_acc   = 0.0

    def on_epoch_begin(self, epoch, logs=None):
        self._epoch_start = time.time()

    def on_epoch_end(self, epoch, logs=None):
        logs    = logs or {}
        elapsed = time.time() - self._epoch_start

        # ── Log to TensorBoard ──
        train_metrics = {k: v for k, v in logs.items() if not k.startswith("val_")}
        val_metrics   = {k[4:]: v for k, v in logs.items() if k.startswith("val_")}

        with self.train_writer.as_default():
            for name, value in train_metrics.items():
                tf.summary.scalar(name, value, step=epoch)
            self.train_writer.flush()

        with self.val_writer.as_default():
            for name, value in val_metrics.items():
                tf.summary.scalar(name, value, step=epoch)
            self.val_writer.flush()

        # ── Console summary ──
        val_acc = logs.get("val_accuracy", 0)
        val_mae = logs.get("val_mae",      1)
        tr_acc  = logs.get("accuracy",     0)
        tr_loss = logs.get("loss",         0)
        val_loss= logs.get("val_loss",     0)
        lr_val  = float(tf.keras.backend.get_value(self.model.optimizer.lr)) \
                  if hasattr(self.model, "optimizer") else 0.0

        if val_acc > self._best_val_acc:
            self._best_val_acc = val_acc
            flag = " 🆕best"
        else:
            flag = ""

        target_ok = "✅" if val_acc >= self.target_accuracy and val_mae <= self.target_mae else ""

        logger.info(
            f"  Epoch {epoch+1:>3} | "
            f"loss={tr_loss:.4f}  acc={tr_acc:.4f} | "
            f"val_loss={val_loss:.4f}  val_acc={val_acc:.4f}  val_mae={val_mae:.4f} | "
            f"lr={lr_val:.2e}  t={elapsed:.1f}s"
            f"{flag}{target_ok}"
        )

    def on_train_end(self, logs=None):
        logger.info(f"\n  Training complete. Best val_accuracy: {self._best_val_acc:.4f}")


# ─────────────────────────────────────────────────────────
# CUSTOM CALLBACK 2 — LR Warmup Scheduler
# ─────────────────────────────────────────────────────────
class LRWarmupScheduler(tf.keras.callbacks.Callback):
    """
    Linear LR warmup for the first `warmup_epochs` epochs,
    then hands control back to the optimizer's scheduler.
    """

    def __init__(self, warmup_epochs: int = 3, target_lr: float = 1e-3):
        super().__init__()
        self.warmup_epochs = warmup_epochs
        self.target_lr     = target_lr

    def on_epoch_begin(self, epoch, logs=None):
        if epoch < self.warmup_epochs:
            lr = self.target_lr * (epoch + 1) / self.warmup_epochs
            tf.keras.backend.set_value(self.model.optimizer.lr, lr)
            logger.info(f"  [WarmupScheduler] Epoch {epoch+1}: lr={lr:.2e}")


# ─────────────────────────────────────────────────────────
# FACTORY — returns all keras callbacks for model.fit
# ─────────────────────────────────────────────────────────
def build_callbacks(train_writer: tf.summary.SummaryWriter,
                    val_writer:   tf.summary.SummaryWriter,
                    ckpt_dir:     str,
                    tb_log_dir:   str,
                    target_accuracy: float = 0.85,
                    target_mae:      float = 0.02,
                    patience_es: int   = 7,
                    patience_lr: int   = 3,
                    min_lr:      float = 1e-7,
                    lr_factor:   float = 0.5):
    """
    Returns a list of all callbacks for use in model.fit / custom loop.
    """
    callbacks = [
        # 1. Custom monitor + TensorBoard writer
        AwareTrainingMonitor(
            train_writer     = train_writer,
            val_writer       = val_writer,
            target_accuracy  = target_accuracy,
            target_mae       = target_mae,
        ),

        # 2. TensorBoard (keras built-in, for graphs & histograms)
        tf.keras.callbacks.TensorBoard(
            log_dir           = tb_log_dir,
            histogram_freq    = 1,
            write_graph       = True,
            update_freq       = "epoch",
        ),

        # 3. Best model checkpoint
        tf.keras.callbacks.ModelCheckpoint(
            filepath          = str(Path(ckpt_dir) / "best_model.keras"),
            monitor           = "val_accuracy",
            save_best_only    = True,
            save_weights_only = False,
            mode              = "max",
            verbose           = 0,
        ),

        # 4. Early stopping
        tf.keras.callbacks.EarlyStopping(
            monitor           = "val_accuracy",
            patience          = patience_es,
            restore_best_weights = True,
            mode              = "max",
            verbose           = 1,
        ),

        # 5. Reduce LR on plateau
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor           = "val_loss",
            factor            = lr_factor,
            patience          = patience_lr,
            min_lr            = min_lr,
            verbose           = 1,
        ),

        # 6. CSV logger
        tf.keras.callbacks.CSVLogger(
            str(Path(ckpt_dir) / "training_log.csv"),
            append = True,
        ),
    ]

    return callbacks
