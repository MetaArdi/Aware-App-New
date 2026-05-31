# tests/test_model.py
# AWARE — Unit Tests
# Run: python -m pytest tests/ -v

import sys
import os
from pathlib import Path

import numpy as np
import tensorflow as tf
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from configs.config import IMG_SIZE, NUM_CLASSES
from src.model import (
    AwareFatigueModel, ChannelAttention,
    FatigueClassificationHead, FocalLoss, build_model
)
from src.utils import compute_metrics


# ─────────────────────────────────────────────────────────
# MODEL TESTS
# ─────────────────────────────────────────────────────────
class TestChannelAttention:
    def test_output_shape(self):
        layer  = ChannelAttention(reduction_ratio=4)
        x      = tf.random.uniform([2, 7, 7, 64])
        out    = layer(x)
        assert out.shape == x.shape, "ChannelAttention harus mempertahankan input shape"

    def test_values_in_range(self):
        layer = ChannelAttention()
        x     = tf.random.uniform([2, 14, 14, 32])
        out   = layer(x)
        # After SE, values should still be reasonable (not exploded)
        assert tf.reduce_max(out).numpy() < 1e6


class TestFatigueHead:
    def test_output_shape_binary(self):
        head = FatigueClassificationHead(num_classes=2)
        x    = tf.random.uniform([4, 7, 7, 128])
        out  = head(x)
        assert out.shape == (4, 1), f"Expected (4,1), got {out.shape}"

    def test_output_dtype(self):
        head = FatigueClassificationHead(num_classes=2)
        x    = tf.random.uniform([2, 7, 7, 64])
        out  = head(x)
        assert out.dtype == tf.float32


class TestAwareFatigueModel:
    @pytest.fixture(scope="class")
    def model(self):
        return build_model()

    def test_forward_pass(self, model):
        x   = tf.random.uniform([2, *IMG_SIZE, 3])
        out = model(x, training=False)
        assert out.shape == (2, 1), f"Expected (2,1) logits, got {out.shape}"

    def test_predict_proba_range(self, model):
        x     = tf.random.uniform([4, *IMG_SIZE, 3])
        probs = model.predict_proba(x)
        assert tf.reduce_min(probs).numpy() >= 0.0
        assert tf.reduce_max(probs).numpy() <= 1.0

    def test_fine_tuning_unfreezes_layers(self, model):
        model.enable_fine_tuning(fine_tune_at=100)
        assert model.backbone.trainable is True

    def test_freeze_backbone(self, model):
        model.freeze_backbone()
        assert model.backbone.trainable is False


# ─────────────────────────────────────────────────────────
# LOSS TESTS
# ─────────────────────────────────────────────────────────
class TestFocalLoss:
    def test_scalar_output(self):
        loss_fn = FocalLoss()
        y_true  = tf.constant([0, 1, 1, 0], dtype=tf.float32)
        y_pred  = tf.constant([0.1, 2.0, -1.0, 0.5])
        loss    = loss_fn(y_true, y_pred)
        assert loss.shape == (), "Loss should be scalar"
        assert loss.numpy() > 0, "Loss should be positive"

    def test_perfect_prediction_low_loss(self):
        loss_fn = FocalLoss(gamma=2.0)
        y_true  = tf.constant([1.0, 1.0, 0.0, 0.0])
        y_pred  = tf.constant([10.0, 10.0, -10.0, -10.0])
        loss    = loss_fn(y_true, y_pred)
        assert loss.numpy() < 0.1, "Perfect predictions should have very low loss"


# ─────────────────────────────────────────────────────────
# METRICS TESTS
# ─────────────────────────────────────────────────────────
class TestComputeMetrics:
    def test_perfect_accuracy(self):
        y_true = [0, 1, 0, 1, 1]
        y_prob = [0.1, 0.9, 0.2, 0.8, 0.7]
        m      = compute_metrics(y_true, y_prob)
        assert m["accuracy"] == 1.0

    def test_mae_calculation(self):
        y_true = [0, 1]
        y_prob = [0.0, 1.0]
        m      = compute_metrics(y_true, y_prob)
        assert abs(m["mae"] - 0.0) < 1e-5

    def test_all_keys_present(self):
        m = compute_metrics([0, 1], [0.3, 0.7])
        assert all(k in m for k in ["accuracy", "mae", "precision", "recall", "f1_score"])


# ─────────────────────────────────────────────────────────
# DATASET PIPELINE TESTS  (no real files needed)
# ─────────────────────────────────────────────────────────
class TestBuildPipeline:
    def test_pipeline_shape(self, tmp_path):
        """Create dummy images and test pipeline."""
        from src.dataset import build_pipeline
        import numpy as np
        from PIL import Image

        # Create dummy class folders
        for cls in ["alert", "drowsy"]:
            folder = tmp_path / cls
            folder.mkdir()
            for i in range(4):
                img = Image.fromarray(np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8))
                img.save(folder / f"img_{i}.jpg")

        paths  = [str(p) for p in tmp_path.rglob("*.jpg")]
        labels = [0 if "alert" in p else 1 for p in paths]

        ds = build_pipeline(paths, labels, augment=False, shuffle=False, batch_size=4)
        for imgs, lbls in ds.take(1):
            assert imgs.shape[1:] == (*IMG_SIZE, 3)
            assert lbls.shape[0] <= 4


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
