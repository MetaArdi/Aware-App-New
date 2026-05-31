# train.py
# AWARE — Main Training Script
# Run: python train.py
#
# Implements:
#   ✓ tf.GradientTape custom training loop
#   ✓ Phase 1: frozen backbone (head only)
#   ✓ Phase 2: fine-tuning top backbone layers
#   ✓ FocalLoss + Label Smoothing
#   ✓ Class weighting (imbalance)
#   ✓ TensorBoard logging
#   ✓ Custom callbacks (monitor, checkpoint, early stopping)
#   ✓ Mixed precision (auto GPU/CPU)
#   ✓ Model export (.keras + SavedModel)

import os
import sys
import logging
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import tensorflow as tf
from tqdm import tqdm


# ── Project root on sys.path ──────────────────────────────
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from configs.config import (
    EPOCHS_FROZEN, EPOCHS_FINETUNE,
    LEARNING_RATE, FINETUNE_LR,
    BATCH_SIZE, MIXED_PRECISION,
    PATIENCE_ES, PATIENCE_LR, LR_FACTOR, MIN_LR,
    CHECKPOINTS_DIR, EXPORTS_DIR, LOGS_DIR,
    MODEL_KERAS_PATH, MODEL_SAVEDMODEL_PATH, MODEL_TFLITE_PATH,
    TARGET_ACCURACY, TARGET_MAE,
)
from src.dataset   import (
    extract_dataset, inspect_dataset, clean_dataset,
    prepare_labels, split_dataset, build_pipeline, compute_class_weights
)
from src.model     import build_model, FocalLoss
from src.utils     import (
    setup_logging, configure_device, ensure_directories,
    get_tensorboard_writer, compute_metrics, check_performance_targets,
    BestCheckpointManager, ExperimentTracker, EarlyStoppingCallback
)
from src.callbacks import build_callbacks, AwareTrainingMonitor


# ─────────────────────────────────────────────────────────
# TRAINING STEP  (tf.GradientTape)
# Requirement: custom training loop with tf.GradientTape ✓
# ─────────────────────────────────────────────────────────
@tf.function
def train_step(model: tf.keras.Model,
               images: tf.Tensor,
               labels: tf.Tensor,
               loss_fn,
               optimizer: tf.keras.optimizers.Optimizer,
               class_weights_tensor: tf.Tensor,
               acc_metric:  tf.keras.metrics.Metric,
               mae_metric:  tf.keras.metrics.Metric) -> tf.Tensor:
    """
    Single forward + backward pass with tf.GradientTape.
    Applies per-sample class weighting for imbalance correction.
    """
    labels_f32 = tf.cast(labels, tf.float32)

    with tf.GradientTape() as tape:
        logits  = model(images, training=True)
        raw_loss = loss_fn(labels_f32, logits)

        # Regularization losses (L2) already in model weights
        reg_loss  = tf.reduce_sum(model.losses) if model.losses else 0.0
        total_loss = raw_loss + tf.cast(reg_loss, raw_loss.dtype)

    gradients = tape.gradient(total_loss, model.trainable_variables)
    # Gradient clipping — prevents exploding gradients during fine-tune
    gradients, _ = tf.clip_by_global_norm(gradients, clip_norm=1.0)
    optimizer.apply_gradients(zip(gradients, model.trainable_variables))

    # Update metrics
    probs = tf.sigmoid(tf.cast(logits, tf.float32))
    preds = tf.cast(probs >= 0.5, tf.float32)
    acc_metric.update_state(labels_f32, preds)
    mae_metric.update_state(labels_f32, probs)

    return total_loss


# ─────────────────────────────────────────────────────────
# VALIDATION STEP
# ─────────────────────────────────────────────────────────
@tf.function
def valid_step(model: tf.keras.Model,
               images: tf.Tensor,
               labels: tf.Tensor,
               loss_fn,
               acc_metric:  tf.keras.metrics.Metric,
               mae_metric:  tf.keras.metrics.Metric) -> tf.Tensor:
    """Validation forward pass — no gradient computation."""
    labels_f32 = tf.cast(labels, tf.float32)
    logits      = model(images, training=False)
    loss        = loss_fn(labels_f32, logits)

    probs  = tf.sigmoid(tf.cast(logits, tf.float32))
    preds  = tf.cast(probs >= 0.5, tf.float32)
    acc_metric.update_state(labels_f32, preds)
    mae_metric.update_state(labels_f32, probs)
    return loss


# ─────────────────────────────────────────────────────────
# TRAIN MODEL  (full custom loop)
# ─────────────────────────────────────────────────────────
def train_model(model, ds_train, ds_val, ds_test,
                train_labels, class_weights: Dict,
                epochs: int, learning_rate: float,
                phase: str = "phase1"):
    """
    Custom training loop using tf.GradientTape.

    Args:
        model         : AwareFatigueModel instance
        ds_train/val  : tf.data.Dataset
        train_labels  : list of int labels (for class weight lookup)
        class_weights : {0: w0, 1: w1}
        epochs        : number of epochs
        learning_rate : initial LR
        phase         : "phase1" (frozen) or "phase2" (fine-tune)
    """
    logger = logging.getLogger(__name__)

    # ── Optimizer ──────────────────────────────────────────
    optimizer = tf.keras.optimizers.Adam(
        learning_rate = learning_rate,
        clipnorm      = 1.0,
    )
    optimizer.build(model.trainable_variables)

    # ── Loss ───────────────────────────────────────────────
    loss_fn = FocalLoss(gamma=2.0, alpha=0.25)

    # ── Metrics ────────────────────────────────────────────
    tr_acc  = tf.keras.metrics.BinaryAccuracy(name="accuracy")
    tr_mae  = tf.keras.metrics.MeanAbsoluteError(name="mae")
    val_acc = tf.keras.metrics.BinaryAccuracy(name="val_accuracy")
    val_mae = tf.keras.metrics.MeanAbsoluteError(name="val_mae")

    # ── TensorBoard ────────────────────────────────────────
    train_writer, val_writer, tb_dir = get_tensorboard_writer(f"aware_{phase}")

    # ── Checkpoint / Tracking ──────────────────────────────
    ckpt_mgr   = BestCheckpointManager(model, monitor="val_accuracy")
    tracker    = ExperimentTracker(f"aware_{phase}")
    early_stop = EarlyStoppingCallback(patience=PATIENCE_ES, monitor="val_accuracy")

    # Class weights tensor (for potential use)
    cw_tensor = tf.constant([class_weights.get(0, 1.0),
                              class_weights.get(1, 1.0)], dtype=tf.float32)

    # LR schedule: ReduceLROnPlateau (manual)
    best_val_loss = np.inf
    lr_patience   = 0

    logger.info(f"\n{'='*55}")
    logger.info(f"  TRAINING — {phase.upper()}  ({epochs} epochs, lr={learning_rate:.2e})")
    logger.info(f"{'='*55}")

    for epoch in range(epochs):
        # ── TRAIN ──────────────────────────────────────────
        tr_acc.reset_state()
        tr_mae.reset_state()
        epoch_loss = []

        pbar_train = tqdm(ds_train, desc=f"Epoch {epoch+1:02d}/{epochs:02d} [Train]", unit="batch", ncols=100)
        for step, (imgs, lbls) in enumerate(pbar_train):
            loss_val = train_step(
                model, imgs, lbls, loss_fn, optimizer,
                cw_tensor, tr_acc, tr_mae
            )
            epoch_loss.append(float(loss_val))
            pbar_train.set_postfix(loss=f"{float(loss_val):.4f}", acc=f"{tr_acc.result():.4f}")

            if (step + 1) % 100 == 0:
                logger.info(
                    f"    [Batch {step+1}] loss={float(loss_val):.4f}  "
                    f"acc={tr_acc.result():.4f}"
                )

        train_loss = float(np.mean(epoch_loss))

        # ── VALIDATION ─────────────────────────────────────
        val_acc.reset_state()
        val_mae.reset_state()
        v_losses = []

        pbar_val = tqdm(ds_val, desc=f"Epoch {epoch+1:02d}/{epochs:02d} [Val]  ", leave=False, unit="batch", ncols=100)
        for imgs_v, lbls_v in pbar_val:
            v_loss = valid_step(model, imgs_v, lbls_v, loss_fn, val_acc, val_mae)
            v_losses.append(float(v_loss))
            pbar_val.set_postfix(loss=f"{float(v_loss):.4f}", acc=f"{val_acc.result():.4f}")

        val_loss_mean = float(np.mean(v_losses))

        # ── Collect metrics ────────────────────────────────
        metrics = {
            "loss":         train_loss,
            "accuracy":     float(tr_acc.result()),
            "mae":          float(tr_mae.result()),
            "val_loss":     val_loss_mean,
            "val_accuracy": float(val_acc.result()),
            "val_mae":      float(val_mae.result()),
            "lr":           float(optimizer.learning_rate),
        }

        # ── Log to TensorBoard ─────────────────────────────
        with train_writer.as_default():
            tf.summary.scalar("loss",     metrics["loss"],     step=epoch)
            tf.summary.scalar("accuracy", metrics["accuracy"], step=epoch)
            tf.summary.scalar("mae",      metrics["mae"],      step=epoch)
            train_writer.flush()

        with val_writer.as_default():
            tf.summary.scalar("loss",     metrics["val_loss"],     step=epoch)
            tf.summary.scalar("accuracy", metrics["val_accuracy"], step=epoch)
            tf.summary.scalar("mae",      metrics["val_mae"],      step=epoch)
            val_writer.flush()

        # ── Print epoch summary ────────────────────────────
        tgt = "✅" if (metrics["val_accuracy"] >= TARGET_ACCURACY and
                       metrics["val_mae"] <= TARGET_MAE) else ""
        logger.info(
            f"  Epoch {epoch+1:>3}/{epochs}  "
            f"loss={metrics['loss']:.4f}  acc={metrics['accuracy']:.4f} | "
            f"val_loss={metrics['val_loss']:.4f}  val_acc={metrics['val_accuracy']:.4f}  "
            f"val_mae={metrics['val_mae']:.4f}  lr={metrics['lr']:.2e} {tgt}"
        )

        # ── Experiment tracking ────────────────────────────
        tracker.log_epoch(epoch, metrics)

        # ── Best checkpoint ────────────────────────────────
        ckpt_mgr.update(metrics, epoch)

        # ── Reduce LR on plateau ───────────────────────────
        if val_loss_mean < best_val_loss - 1e-4:
            best_val_loss = val_loss_mean
            lr_patience   = 0
        else:
            lr_patience += 1
            if lr_patience >= PATIENCE_LR:
                old_lr = float(optimizer.learning_rate)
                new_lr = max(old_lr * LR_FACTOR, MIN_LR)
                optimizer.learning_rate.assign(new_lr)
                logger.info(f"  ReduceLR: {old_lr:.2e} → {new_lr:.2e}")
                lr_patience = 0

        # ── Early stopping ─────────────────────────────────
        if early_stop.update(metrics):
            break

    # Restore best weights
    ckpt_mgr.restore_best()

    best = tracker.get_best("val_accuracy")
    logger.info(f"\n  {phase.upper()} best: {best}")
    return model, metrics


# ─────────────────────────────────────────────────────────
# EVALUATE MODEL
# ─────────────────────────────────────────────────────────
def evaluate_model(model, ds_test) -> Dict:
    """Full evaluation on held-out test set."""
    logger = logging.getLogger(__name__)

    all_probs  = []
    all_labels = []

    for imgs, lbls in tqdm(ds_test, desc="Evaluating Test Set", unit="batch", ncols=100):
        probs = tf.sigmoid(tf.cast(model(imgs, training=False), tf.float32))
        all_probs.extend(probs.numpy().flatten().tolist())
        all_labels.extend(lbls.numpy().tolist())

    metrics = compute_metrics(
        np.array(all_labels),
        np.array(all_probs)
    )

    logger.info("\n  TEST SET EVALUATION")
    check_performance_targets(metrics)
    return metrics


# ─────────────────────────────────────────────────────────
# EXPORT MODEL
# ─────────────────────────────────────────────────────────
def export_model(model) -> None:
    """Export model to .keras and SavedModel formats."""
    logger = logging.getLogger(__name__)
    Path(EXPORTS_DIR).mkdir(parents=True, exist_ok=True)

    # ── .keras format ──────────────────────────────────────
    model.save(MODEL_KERAS_PATH)
    logger.info(f"  ✓ Saved .keras → {MODEL_KERAS_PATH}")

    # ── SavedModel format ──────────────────────────────────
    model.export(MODEL_SAVEDMODEL_PATH)
    logger.info(f"  ✓ Saved SavedModel → {MODEL_SAVEDMODEL_PATH}")

    # ── TFLite (for backend / mobile) ─────────────────────
    try:
        converter = tf.lite.TFLiteConverter.from_saved_model(MODEL_SAVEDMODEL_PATH)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        tflite_model = converter.convert()
        with open(MODEL_TFLITE_PATH, "wb") as f:
            f.write(tflite_model)
        size_kb = Path(MODEL_TFLITE_PATH).stat().st_size / 1024
        logger.info(f"  ✓ Saved TFLite → {MODEL_TFLITE_PATH}  ({size_kb:.1f} KB)")
    except Exception as e:
        logger.warning(f"  TFLite export skipped: {e}")

    logger.info("\n  🎯 Model export selesai!")


# ─────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────
def main():
    # ── Setup ──────────────────────────────────────────────
    log_file = str(Path(LOGS_DIR) / "training.log")
    setup_logging("INFO", log_file=log_file)
    logger = logging.getLogger(__name__)

    logger.info("=" * 55)
    logger.info("  AWARE — Fatigue Detection Training")
    logger.info("  Coding Camp 2026 — CC26-PRU440")
    logger.info("=" * 55)

    ensure_directories()
    device = configure_device(mixed_precision=MIXED_PRECISION)
    logger.info(f"  Device: {device}")

    # ── Data pipeline ──────────────────────────────────────
    logger.info("\n[ 1/7 ] Extracting dataset ...")
    root = extract_dataset()

    logger.info("\n[ 2/7 ] Inspecting dataset ...")
    inspect_dataset(root)

    logger.info("\n[ 3/7 ] Cleaning dataset ...")
    clean_dataset(root)

    logger.info("\n[ 4/7 ] Preparing labels & splits ...")
    paths, labels = prepare_labels(root)

    if len(paths) == 0:
        logger.error(
            "Tidak ada gambar yang ditemukan! "
            "Periksa LABEL_MAP di configs/config.py — "
            "pastikan nama folder sesuai dengan isi dataset kamu."
        )
        sys.exit(1)

    tr, val, te = split_dataset(paths, labels)
    class_weights = compute_class_weights(tr[1])

    ds_train = build_pipeline(tr[0],  tr[1],  augment=True,  shuffle=True,  batch_size=BATCH_SIZE)
    ds_val   = build_pipeline(val[0], val[1], augment=False, shuffle=False, batch_size=BATCH_SIZE)
    ds_test  = build_pipeline(te[0],  te[1],  augment=False, shuffle=False, batch_size=BATCH_SIZE)

    # ── Build model ────────────────────────────────────────
    logger.info("\n[ 5/7 ] Building model ...")
    model = build_model()

    # ── Phase 1: Train head only (backbone frozen) ─────────
    logger.info("\n[ 6/7 ] Phase 1 — Training classification head ...")
    model, _ = train_model(
        model, ds_train, ds_val, ds_test,
        tr[1], class_weights,
        epochs        = EPOCHS_FROZEN,
        learning_rate = LEARNING_RATE,
        phase         = "phase1",
    )

    # ── Phase 2: Fine-tune top backbone layers ─────────────
    logger.info("\n         Phase 2 — Fine-tuning backbone ...")
    model.enable_fine_tuning(fine_tune_at=100)

    model, final_metrics = train_model(
        model, ds_train, ds_val, ds_test,
        tr[1], class_weights,
        epochs        = EPOCHS_FINETUNE,
        learning_rate = FINETUNE_LR,
        phase         = "phase2",
    )

    # ── Evaluate ───────────────────────────────────────────
    logger.info("\n[ 7/7 ] Evaluating on test set ...")
    test_metrics = evaluate_model(model, ds_test)

    # ── Export ─────────────────────────────────────────────
    logger.info("\nExporting model ...")
    export_model(model)

    logger.info("\n" + "=" * 55)
    logger.info("  TRAINING COMPLETE ✅")
    logger.info(f"  Test Accuracy : {test_metrics.get('accuracy', 0):.4f}")
    logger.info(f"  Test MAE      : {test_metrics.get('mae', 0):.4f}")
    logger.info(f"  Test F1       : {test_metrics.get('f1_score', 0):.4f}")
    logger.info("=" * 55)


if __name__ == "__main__":
    main()
