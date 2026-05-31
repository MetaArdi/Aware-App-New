# AWARE — AI-Based Workplace Assessment for Readiness and Safety
**Coding Camp 2026 | DBS Foundation | Team CC26-PRU440**

---

## 🎯 Project Overview

Sistem deteksi kelelahan (fatigue detection) berbasis Computer Vision + Deep Learning untuk screening kesiapan kerja karyawan (fit-to-work) sebelum shift dimulai.

**AI Engineer Task:**
- Model klasifikasi fatigue dengan MobileNetV2 + Channel Attention
- Custom training loop menggunakan `tf.GradientTape`
- Custom Layer, Custom Loss (Focal Loss), Custom Callback
- TensorBoard monitoring & experiment tracking
- Export `.keras` + `SavedModel` + `TFLite`

---

## 📁 Project Structure

```
aware-project/
│
├── configs/
│   └── config.py          ← Semua hyperparameter & path
│
├── src/
│   ├── dataset.py         ← Extract, inspect, clean, tf.data pipeline
│   ├── model.py           ← AwareFatigueModel, ChannelAttention, FocalLoss
│   ├── utils.py           ← Logging, metrics, TensorBoard, checkpoints
│   └── callbacks.py       ← Custom callbacks + factory
│
├── api/
│   └── main.py            ← FastAPI skeleton (untuk integrasi backend)
│
├── tests/
│   └── test_model.py      ← Unit tests (pytest)
│
├── logs/                  ← Training logs + TensorBoard events
├── checkpoints/           ← Best model weights
├── exports/               ← Final exported models
├── dataset/               ← (kosong, source ZIP)
├── extracted/             ← Dataset setelah di-extract
│
├── main.py                ← Entry point (full pipeline)
├── train.py               ← Training script
├── infer.py               ← Inference CLI
└── requirements.txt
```

---

## ⚙️ Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Pastikan dataset ZIP ada

```
C:\Users\dzikri\Downloads\aware-project\_output_.zip
```

### 3. Sesuaikan LABEL_MAP (configs/config.py)

Buka `configs/config.py` dan sesuaikan `LABEL_MAP` dengan nama folder di dalam dataset kamu:

```python
LABEL_MAP = {
    "alert":  0,   # ganti sesuai nama folder
    "drowsy": 1,
    "yawn":   1,
}
```

Untuk melihat nama folder yang ada, jalankan inspect dulu:

```bash
python main.py --inspect
```

---

## 🚀 Running

### Full pipeline (extract → train → export)
```bash
python train.py
```

### Hanya inspect dataset
```bash
python main.py --inspect
```

### Hanya evaluate model
```bash
python main.py --eval
```

### Inference — single image
```bash
python infer.py --image foto_karyawan.jpg
```

### Inference — folder
```bash
python infer.py --folder dataset/test/
```

### Inference — webcam (real-time)
```bash
python infer.py --webcam
```

### Unit tests
```bash
python -m pytest tests/ -v
```

### TensorBoard
```bash
tensorboard --logdir logs/tensorboard
```
Buka: http://localhost:6006

---

## 🧠 Model Architecture

```
Input (224×224×3)
    ↓
MobileNetV2 backbone (pre-trained ImageNet)
    ↓
ChannelAttention (SE block, ratio=8)
    ↓
FatigueClassificationHead
    ├── GlobalAveragePooling2D
    ├── BatchNorm + Dropout(0.4)
    ├── Dense(256, relu)
    ├── BatchNorm + Dropout(0.2)
    └── Dense(1, sigmoid)
    ↓
Output: fatigue probability [0, 1]
```

**Training Strategy:**
- Phase 1 (10 epochs): backbone frozen, train head only — cepat konvergen
- Phase 2 (20 epochs): unfreeze top layers, fine-tune dengan LR rendah (1e-5)

---

## 🎯 Performance Targets

| Metric   | Target | Description |
|----------|--------|-------------|
| Accuracy | ≥ 85%  | Overall classification accuracy |
| MAE      | ≤ 0.02 | Mean Absolute Error probability |

---

## 📋 Implemented Requirements

| Requirement | Status | Location |
|---|---|---|
| TF Functional API / Subclassing | ✅ Model Subclassing | `src/model.py` |
| Custom Layer | ✅ ChannelAttention | `src/model.py` |
| Custom Loss | ✅ FocalLoss | `src/model.py` |
| Custom Callback | ✅ AwareTrainingMonitor | `src/callbacks.py` |
| tf.GradientTape | ✅ train_step / valid_step | `train.py` |
| TensorBoard | ✅ Integrated | `src/utils.py`, `src/callbacks.py` |
| Metrics logging | ✅ ExperimentTracker | `src/utils.py` |
| Checkpoint | ✅ BestCheckpointManager | `src/utils.py` |
| Export `.keras` | ✅ | `train.py → export_model()` |
| Export SavedModel | ✅ | `train.py → export_model()` |

---

## 👥 Team

| ID | Nama | Role |
|---|---|---|
| CACC222D6Y1633 | Dzikri Rabbani | AI Engineer |
| CACC200D6Y1641 | Syafiq Abiyyu Taqi | AI Engineer |
| CDCC012D6X0997 | Annisa Safitri | Data Scientist |
| CDCC200D6Y1004 | Kevin Ananda | Data Scientist |
| CFCC002D6X1897 | Sekar Ayu | Full-Stack Dev |
