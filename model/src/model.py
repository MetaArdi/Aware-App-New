# src/model.py
# AWARE — Model Architecture
# MobileNetV2 backbone + Channel Attention + Custom Layer + Model Subclassing
# Requirement: TF Functional API OR Model Subclassing → kita pakai Subclassing

import sys
import logging
from pathlib import Path
from typing import Optional, Tuple

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, regularizers

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from configs.config import (
    IMG_SIZE, NUM_CLASSES, DROPOUT_RATE, L2_REG,
    BACKBONE, LABEL_SMOOTHING
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────
# CUSTOM LAYER 1 — Channel Attention (Squeeze-and-Excitation)
# Requirement: Custom Layer ✓
# ─────────────────────────────────────────────────────────
class ChannelAttention(layers.Layer):
    """
    Squeeze-and-Excitation block.
    Re-calibrates channel-wise feature responses adaptively.
    Helps model focus on eye/mouth regions important for fatigue detection.
    """

    def __init__(self, reduction_ratio: int = 8, **kwargs):
        super().__init__(**kwargs)
        self.reduction_ratio = reduction_ratio

    def build(self, input_shape):
        channels = input_shape[-1]
        r        = max(1, channels // self.reduction_ratio)

        self.gap = layers.GlobalAveragePooling2D()
        self.fc1 = layers.Dense(r, activation="relu",
                                kernel_regularizer=regularizers.l2(L2_REG))
        self.fc2 = layers.Dense(channels, activation="sigmoid",
                                kernel_regularizer=regularizers.l2(L2_REG))
        super().build(input_shape)

    def call(self, x: tf.Tensor, training: bool = False) -> tf.Tensor:
        # Squeeze
        z  = self.gap(x)                          # (B, C)
        # Excitation
        z  = self.fc1(z, training=training)        # (B, C//r)
        z  = self.fc2(z, training=training)        # (B, C)
        # Scale
        z  = tf.reshape(z, [-1, 1, 1, tf.shape(z)[-1]])
        return x * z                               # broadcast multiply

    def get_config(self):
        cfg = super().get_config()
        cfg.update({"reduction_ratio": self.reduction_ratio})
        return cfg


# ─────────────────────────────────────────────────────────
# CUSTOM LAYER 2 — FatigueHead (classification head)
# ─────────────────────────────────────────────────────────
class FatigueClassificationHead(layers.Layer):
    """
    Custom classification head with:
    - Global Average Pooling
    - Batch Normalization
    - Dropout
    - Dense output
    """

    def __init__(self, num_classes: int = NUM_CLASSES,
                 dropout_rate: float = DROPOUT_RATE, **kwargs):
        super().__init__(**kwargs)
        self.num_classes  = num_classes
        self.dropout_rate = dropout_rate

    def build(self, input_shape):
        self.gap    = layers.GlobalAveragePooling2D()
        self.bn1    = layers.BatchNormalization()
        self.drop1  = layers.Dropout(self.dropout_rate)
        self.dense1 = layers.Dense(256, activation="relu",
                                   kernel_regularizer=regularizers.l2(L2_REG))
        self.bn2    = layers.BatchNormalization()
        self.drop2  = layers.Dropout(self.dropout_rate / 2)
        self.out    = layers.Dense(
            1 if self.num_classes == 2 else self.num_classes,
            dtype="float32"       # always float32 for stability
        )
        super().build(input_shape)

    def call(self, x: tf.Tensor, training: bool = False) -> tf.Tensor:
        x = self.gap(x)
        x = self.bn1(x, training=training)
        x = self.drop1(x, training=training)
        x = self.dense1(x, training=training)
        x = self.bn2(x, training=training)
        x = self.drop2(x, training=training)
        return self.out(x)

    def get_config(self):
        cfg = super().get_config()
        cfg.update({
            "num_classes":  self.num_classes,
            "dropout_rate": self.dropout_rate,
        })
        return cfg


# ─────────────────────────────────────────────────────────
# MAIN MODEL — AwareFatigueModel (Model Subclassing)
# Requirement: Model Subclassing ✓
# ─────────────────────────────────────────────────────────
class AwareFatigueModel(keras.Model):
    """
    AWARE Fatigue Detection Model.

    Architecture:
        MobileNetV2 backbone (pre-trained on ImageNet)
        └── Channel Attention (SE block)
        └── FatigueClassificationHead
            └── GAP → BN → Dropout → Dense(256) → BN → Dropout → Sigmoid

    Training phases:
        Phase 1: backbone frozen, only head trained  (fast convergence)
        Phase 2: top N layers of backbone unfrozen  (fine-tuning)
    """

    def __init__(self,
                 num_classes:   int   = NUM_CLASSES,
                 dropout_rate:  float = DROPOUT_RATE,
                 input_shape:   Tuple = (*IMG_SIZE, 3),
                 fine_tune_at:  int   = 100,   # unfreeze layers from this index
                 **kwargs):
        super().__init__(**kwargs)

        self.num_classes  = num_classes
        self.dropout_rate = dropout_rate
        self._input_shape = input_shape
        self.fine_tune_at = fine_tune_at

        # ── Backbone ──
        base = keras.applications.MobileNetV2(
            input_shape=input_shape,
            include_top=False,
            weights="imagenet"
        )
        base.trainable = False    # Phase 1: frozen
        self.backbone  = base

        # ── Attention ──
        self.attention = ChannelAttention(reduction_ratio=8, name="channel_attention")

        # ── Head ──
        self.head = FatigueClassificationHead(
            num_classes  = num_classes,
            dropout_rate = dropout_rate,
            name         = "fatigue_head"
        )

        # Build with dummy input so weights are initialized
        self(tf.zeros([1, *input_shape]), training=False)

    # ── Forward pass ─────────────────────────────────────
    def call(self, x: tf.Tensor, training: bool = False) -> tf.Tensor:
        # MobileNetV2 expects [0,1] float32 — apply built-in preprocessing
        x = keras.applications.mobilenet_v2.preprocess_input(x * 255.0)
        x = self.backbone(x, training=training)
        x = self.attention(x, training=training)
        x = self.head(x, training=training)
        return x

    # ── Predictions ──────────────────────────────────────
    def predict_proba(self, x: tf.Tensor, training: bool = False) -> tf.Tensor:
        """Returns probability for class 1 (fatigue)."""
        logits = self(x, training=training)
        return tf.sigmoid(logits)

    # ── Phase 2: unfreeze top layers ─────────────────────
    def enable_fine_tuning(self, fine_tune_at: Optional[int] = None):
        """
        Unfreeze backbone layers from `fine_tune_at` onward.
        Call this before Phase 2 training.
        """
        at = fine_tune_at or self.fine_tune_at
        self.backbone.trainable = True
        for layer in self.backbone.layers[:at]:
            layer.trainable = False
        trainable_count = sum(1 for l in self.backbone.layers if l.trainable)
        logger.info(f"Fine-tuning: {trainable_count} backbone layers unfrozen (from idx {at})")

    def freeze_backbone(self):
        """Re-freeze backbone (back to Phase 1)."""
        self.backbone.trainable = False
        logger.info("Backbone frozen (Phase 1 mode).")

    def summary_custom(self):
        logger.info("=" * 55)
        logger.info("  AWARE FATIGUE MODEL SUMMARY")
        logger.info("=" * 55)
        logger.info(f"  Backbone     : {BACKBONE} (ImageNet weights)")
        logger.info(f"  Attention    : ChannelAttention (SE, ratio=8)")
        logger.info(f"  Head         : FatigueClassificationHead")
        logger.info(f"  Input shape  : {self._input_shape}")
        logger.info(f"  Num classes  : {self.num_classes}")
        logger.info(f"  Dropout      : {self.dropout_rate}")
        total_params = sum(tf.size(v).numpy() for v in self.trainable_variables)
        logger.info(f"  Trainable params : {total_params:,}")
        logger.info("=" * 55)

    def get_config(self):
        return {
            "num_classes":  self.num_classes,
            "dropout_rate": self.dropout_rate,
            "input_shape":  self._input_shape,
            "fine_tune_at": self.fine_tune_at,
        }

    @classmethod
    def from_config(cls, config):
        return cls(**config)


# ─────────────────────────────────────────────────────────
# CUSTOM LOSS — Focal Loss
# Requirement: Custom Loss Function ✓
# Great for imbalanced classes (drowsy samples often fewer)
# ─────────────────────────────────────────────────────────
class FocalLoss(keras.losses.Loss):
    """
    Binary Focal Loss.
    FL(p_t) = -alpha_t * (1 - p_t)^gamma * log(p_t)

    - gamma > 0 reduces loss for easy (well-classified) examples.
    - alpha handles class imbalance.
    """

    def __init__(self, gamma: float = 2.0, alpha: float = 0.25,
                 label_smoothing: float = LABEL_SMOOTHING, **kwargs):
        super().__init__(**kwargs)
        self.gamma           = gamma
        self.alpha           = alpha
        self.label_smoothing = label_smoothing

    def call(self, y_true: tf.Tensor, y_pred: tf.Tensor) -> tf.Tensor:
        y_true = tf.cast(tf.reshape(y_true, [-1]), tf.float32)
        y_pred = tf.reshape(y_pred, [-1])

        # Label smoothing
        y_true = y_true * (1 - self.label_smoothing) + 0.5 * self.label_smoothing

        bce    = tf.nn.sigmoid_cross_entropy_with_logits(
                     labels=y_true, logits=y_pred)
        p_t    = tf.exp(-bce)
        alpha_t = y_true * self.alpha + (1 - y_true) * (1 - self.alpha)
        focal  = alpha_t * tf.pow(1.0 - p_t, self.gamma) * bce
        return tf.reduce_mean(focal)

    def get_config(self):
        cfg = super().get_config()
        cfg.update({
            "gamma":           self.gamma,
            "alpha":           self.alpha,
            "label_smoothing": self.label_smoothing,
        })
        return cfg


# ─────────────────────────────────────────────────────────
# FACTORY
# ─────────────────────────────────────────────────────────
def build_model(num_classes:  int   = NUM_CLASSES,
                dropout_rate: float = DROPOUT_RATE,
                fine_tune_at: int   = 100) -> AwareFatigueModel:
    """Convenience factory used by train.py."""
    model = AwareFatigueModel(
        num_classes  = num_classes,
        dropout_rate = dropout_rate,
        fine_tune_at = fine_tune_at,
    )
    model.summary_custom()
    return model


# ─────────────────────────────────────────────────────────
# QUICK SELF-TEST
# ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-8s  %(message)s")

    print("\n[ model.py — self-test ]")
    model = build_model()

    dummy = tf.random.uniform([4, *IMG_SIZE, 3])
    out   = model(dummy, training=False)
    prob  = model.predict_proba(dummy)

    print(f"  Logit shape : {out.shape}")
    print(f"  Prob  shape : {prob.shape}")
    print(f"  Probs sample: {prob.numpy().flatten()[:4]}")

    loss_fn = FocalLoss()
    dummy_labels = tf.constant([0, 1, 1, 0], dtype=tf.float32)
    loss_val = loss_fn(dummy_labels, out)
    print(f"  Focal loss  : {loss_val.numpy():.4f}")

    print("\n✅  model.py self-test selesai.")
