"""
Risk Scoring Engine
───────────────────
Menggabungkan skor CV (fatigue) dengan data self-report
untuk menghasilkan risk_score final (0.0 – 1.0)

Bobot default:
  CV fatigue score  : 60%
  Sleep hours score : 25%
  Energy level score: 15%
"""


def score_from_sleep(hours: float) -> float:
    """Lebih sedikit tidur → skor risiko lebih tinggi"""
    if hours >= 8:
        return 0.0
    if hours >= 6:
        return 0.3
    if hours >= 4:
        return 0.6
    return 1.0


def score_from_energy(level: int) -> float:
    """Energi rendah → risiko tinggi (skala 1–5, dibalik)"""
    return round((5 - level) / 4.0, 2)


def calculate_risk_score(
    fatigue_score: float,
    sleep_hours:   float = 7.0,
    energy_level:  int   = 3,
    ear_avg:       float = 0.3,
    yawn_count:    int   = 0
) -> float:
    cv_weight     = 0.60
    sleep_weight  = 0.25
    energy_weight = 0.15

    sleep_score  = score_from_sleep(sleep_hours)
    energy_score = score_from_energy(energy_level)

    # Base risk calculation
    risk = (
        cv_weight     * fatigue_score +
        sleep_weight  * sleep_score   +
        energy_weight * energy_score
    )

    # Hybrid Enhancements (MediaPipe Analysis)
    # 1. EAR Penalty: If eyes are significantly closed (EAR < 0.22)
    if ear_avg < 0.22 and ear_avg > 0:
        risk += 0.20 # Push risk significantly higher
    
    # 2. Yawn Penalty: Detectable yawn is a strong indicator
    # penalty increases with yawn intensity/count
    if yawn_count > 0:
        # 1-3 frames of yawn is a warning (+0.1), more is severe (+0.2)
        penalty = 0.1 if yawn_count < 5 else 0.2
        risk += penalty

    # Ensure risk is in range [0.0, 1.0]
    return round(max(0.0, min(risk, 1.0)), 4)


def determine_status(risk_score: float) -> tuple:
    """Mengembalikan (status, message, recommendation)"""
    if risk_score < 0.35:
        return (
            "fit",
            "Anda dalam kondisi prima dan siap bekerja hari ini.",
            "Tetap jaga kondisi fisik dan pola tidur yang baik."
        )
    elif risk_score < 0.65:
        return (
            "at_risk",
            "Kondisi Anda perlu diperhatikan. Ada tanda-tanda kelelahan awal.",
            "Lakukan pemanasan ringan, minum air, dan beritahu supervisor jika merasa tidak nyaman."
        )
    else:
        return (
            "not_fit",
            "Anda terdeteksi dalam kondisi kelelahan tinggi. Tidak direkomendasikan untuk bekerja.",
            "Segera hubungi supervisor dan beristirahat. Jangan operasikan mesin atau kendaraan."
        )