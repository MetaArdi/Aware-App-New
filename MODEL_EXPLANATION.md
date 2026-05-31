# Dokumentasi Sistem Hybrid Fatigue Detection (AWARE)

Dokumen ini menjelaskan arsitektur, metodologi, dan logika perhitungan di balik sistem deteksi kelelahan hybrid yang digunakan dalam proyek AWARE.

## 1. Arsitektur Hybrid
Sistem AWARE menggabungkan dua pendekatan berbeda untuk mencapai akurasi maksimal:
1.  **Pendekatan Geometris (MediaPipe)**: Mengukur metrik fisik spesifik (Mata dan Mulut).
2.  **Pendekatan Deep Learning (CNN - MobileNetV2)**: Menganalisis fitur wajah secara holistik melalui ekstraksi pola piksel.

---

## 2. Karakteristik Komponen

### A. MediaPipe (Pedekatan Geometris)
*   **Apa yang dihitung**: Jarak antar landmark wajah (Face Mesh 468 titik).
*   **Metrik Utama**:
    *   **EAR (Eye Aspect Ratio)**: Rasio keterbukaan mata.
    *   **MAR (Mouth Aspect Ratio)**: Rasio keterbukaan mulut.
*   **Karakteristik**: Deterministik, berbasis rumus matematika pasti, sangat cepat (Low Latency).

### B. CNN MobileNetV2 (Pendekatan Deep Learning)
*   **Apa yang dihitung**: Fitur wajah dari gambar yang telah di-**crop otomatis** berbasis bounding box MediaPipe, kemudian diubah ukurannya (224x224).
*   **Metrik Utama**: **Fatigue Score (0.0 - 1.0)**.
*   **Karakteristik**: Probabilistik, mampu menangkap tanda-tanda halus (sayu, posisi kepala) yang divalidasi dengan fungsi **Sigmoid** untuk akurasi probabilitas.

---

## 3. Detail Perhitungan Metrik

### Deteksi Kelelahan (CNN)
Sistem melakukan ekstraksi frame dan melakukan transformasi linear melalui model:
$$Score_{raw} = Model(Input_{cropped})$$
$$Fatigue = \frac{1}{1 + e^{-Score_{raw}}}$$
*   **Interpretasi**: Menggunakan probabilitas sigmoid untuk memastikan rentang skor yang konsisten di 0.0 - 1.0.

### EAR (Eye Aspect Ratio)
Dihitung menggunakan rumus:
$$EAR = \frac{||p_2 - p_6|| + ||p_3 - p_5||}{2||p_1 - p_4||}$$
*   **Interpretasi**: Jika $EAR < 0.22$, mata dianggap tertutup/berkedip. Jika rata-rata EAR dalam 15 detik rendah, ini indikasi kuat kelelahan/kantuk kronis.

### MAR (Mouth Aspect Ratio)
Dihitung menggunakan rumus serupa untuk landmark bibir:
$$MAR = \frac{||m_2 - m_8|| + ||m_3 - m_7|| + ||m_4 - m_6||}{2||m_1 - m_5||}$$
*   **Interpretasi**: Jika $MAR > 0.5$ secara berulang, sistem mendeteksi aktivitas menguap (*yawning*).

---

## 4. Logika Penggabungan (Hybrid Risk Scoring)

Skor risiko akhir (**Total Risk Score**) menggunakan pendekatan **Base Score + Dynamic Penalty** untuk memastikan akurasi deteksi:

```python
# Bobot Kontribusi Base Score
WEIGHT_CNN          = 0.60  # Kontribusi Skor Model CNN (Inti)
WEIGHT_SLEEP        = 0.25  # Berdasarkan Jam Tidur (Self-report)
WEIGHT_ENERGY       = 0.15  # Berdasarkan Level Energi (Self-report)

# Dynamic Penalties (MediaPipe Driven)
PENALTY_EAR_LOW    = +0.20  # Jika mata terdeteksi tertutup/sayu kronis
PENALTY_YAWN       = +0.15  # Jika terdeteksi aktivitas menguap
```

### Rumus Gabungan:
1.  **Base Calculation**: `(CNN * 0.6) + (Sleep_Score * 0.25) + (Energy_Score * 0.15)`
2.  **Geometry Validation**: Jika MediaPipe mendeteksi metrik fisik yang parah (EAR rendah atau Yawn tinggi), skor risiko akan dinaikkan (*penalty*).
3.  **Final Score**: Total dari kedua poin di atas, diklip di rentang 0.0 - 1.0.

---

## 5. Keunggulan & Kelemahan

### Keunggulan
*   **Akurasi Berlapis**: Model CNN fokus pada tekstur wajah (sayu), sementara MediaPipe memvalidasi lewat geometri (penutupan mata/mulut).
*   **Preprocessing Cerdas**: Implementasi **Face Cropping** otomatis memastikan model hanya fokus pada area wajah, mengurangi noise dari background.
*   **Real-time Feedback**: Pengguna mendapatkan visualisasi landmark dan metrik EAR/MAR instan.

### Kelemahan
*   **Ketergantungan Cahaya**: Kedua model akan menurun akurasinya jika pencahayaan ruangan redup atau terjadi *backlight*.
*   **Hardware Intensive**: Menjalankan analisis batch 30 frame dengan model CNN membutuhkan spesifikasi server yang lebih mumpuni dibanding metode geometri sederhana.
*   **Variasi Landmark**: Penggunaan kacamata tebal kadang dapat mengganggu deteksi "Face Mesh" MediaPipe untuk titik mata.

---
*Dokumen ini merupakan bagian dari spesifikasi teknis Proyek AWARE - CC26-PRU440.*