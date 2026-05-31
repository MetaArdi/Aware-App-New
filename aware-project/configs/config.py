# configs/config.py
# AWARE: AI-Based Workplace Assessment for Readiness and Safety
# Configuration file — centralized hyperparameters & paths

import os

# ─────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────
BASE_DIR       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP_PATH       = os.path.join(BASE_DIR, "_output_.zip")
DATASET_DIR    = os.path.join(BASE_DIR, "dataset")
EXTRACTED_DIR  = os.path.join(BASE_DIR, "extracted")
LOGS_DIR       = os.path.join(BASE_DIR, "logs")
CHECKPOINTS_DIR= os.path.join(BASE_DIR, "checkpoints")
EXPORTS_DIR    = os.path.join(BASE_DIR, "exports")
TESTS_DIR      = os.path.join(BASE_DIR, "tests")

# ─────────────────────────────────────────────
# DATA
# ─────────────────────────────────────────────
IMG_SIZE       = (224, 224)       # MobileNetV2 native input
BATCH_SIZE     = 32
TRAIN_SPLIT    = 0.70
VAL_SPLIT      = 0.15
TEST_SPLIT     = 0.15
RANDOM_SEED    = 42

# Label mapping — adjust after running inspect_dataset()
# Expected folder names inside extracted dataset
LABEL_MAP = {
    "non_drowsy": 0,   # fit / awake
    "no_yawning": 0,   # fit / awake
    "drowsy":     1,   # fatigue / not fit
    "yawning":    1,   # fatigue / not fit
}
NUM_CLASSES = 2   # binary: alert=0 vs fatigue=1
CLASS_NAMES = ["alert", "fatigue"]

# ─────────────────────────────────────────────
# MODEL
# ─────────────────────────────────────────────
BACKBONE       = "MobileNetV2"    # lightweight, real-time capable
DROPOUT_RATE   = 0.4
L2_REG         = 1e-4
LABEL_SMOOTHING= 0.1

# ─────────────────────────────────────────────
# TRAINING
# ─────────────────────────────────────────────
EPOCHS_FROZEN  = 10   # Phase 1: train head only (backbone frozen)
EPOCHS_FINETUNE= 20   # Phase 2: fine-tune top layers
LEARNING_RATE  = 1e-3
FINETUNE_LR    = 1e-5
MIXED_PRECISION= True  # auto-disabled if no GPU

# ─────────────────────────────────────────────
# CALLBACKS / MONITORING
# ─────────────────────────────────────────────
PATIENCE_ES    = 7    # early stopping patience
PATIENCE_LR    = 3    # reduce-LR-on-plateau patience
LR_FACTOR      = 0.5
MIN_LR         = 1e-7

# ─────────────────────────────────────────────
# PERFORMANCE TARGETS (tugas requirement)
# ─────────────────────────────────────────────
TARGET_ACCURACY = 0.85
TARGET_MAE      = 0.02

# ─────────────────────────────────────────────
# EXPORT
# ─────────────────────────────────────────────
MODEL_KERAS_PATH      = os.path.join(EXPORTS_DIR, "aware_fatigue_model.keras")
MODEL_SAVEDMODEL_PATH = os.path.join(EXPORTS_DIR, "aware_fatigue_savedmodel")
MODEL_TFLITE_PATH     = os.path.join(EXPORTS_DIR, "aware_fatigue_model.tflite")
