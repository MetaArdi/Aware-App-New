# AWARE
AI-Based Workplace Assessment for Readiness and Safety. A web-based fit-to-work screening system that detects employee fatigue in under 30 seconds using Computer Vision (EAR/MAR analysis via MediaPipe) combined with self-reported health data to prevent workplace accidents.

## 🧠 Hybrid Fatigue Detection
Sistem AWARE menggunakan pendekatan hybrid yang menggabungkan analisis geometris wajah dan deteksi berbasis Deep Learning untuk akurasi maksimal dalam menilai kesiapan kerja.

*   **MediaPipe Integration**: Menganalisis metrik fisik seperti EAR (*Eye Aspect Ratio*) dan MAR (*Mouth Aspect Ratio*).
*   **CNN MobileNetV2**: Menganalisis tekstur dan fitur wajah secara holistik dengan *automatic face cropping*.
*   **Risk Scoring**: Penggabungan cerdas antara metrik visual dan data laporan mandiri pengguna.

Untuk penjelasan teknis mendalam mengenai arsitektur model, rumus perhitungan, dan logika *risk scoring*, silakan baca:
👉 **[Dokumentasi Hybrid Fatigue Detection](docs/specs/HYBRID_MODEL_EXPLANATION.md)**

