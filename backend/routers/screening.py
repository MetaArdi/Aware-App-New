from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
from models.database import get_db, ScreeningResult, Employee, User
from schemas.schemas import ScreeningRequest, ScreeningResponse
from services.ml_client import call_ml_predict
from services.risk_scoring import calculate_risk_score, determine_status
from core.auth import get_current_user

router = APIRouter(prefix="/screening", tags=["Screening"])


@router.post("/analyze", response_model=ScreeningResponse)
async def analyze(
    req: ScreeningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Validasi karyawan
    employee = db.query(Employee).filter(Employee.id == req.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")

    # 2. Cek apakah sudah screening hari ini
    today_start = datetime.combine(date.today(), datetime.min.time())
    existing = db.query(ScreeningResult).filter(
        ScreeningResult.employee_id  == req.employee_id,
        ScreeningResult.screening_date >= today_start
    ).first()

    if existing:
        _, _, rec = determine_status(existing.risk_score)
        return ScreeningResponse(
            status=existing.status,
            risk_score=existing.risk_score,
            fatigue_score=existing.fatigue_score,
            message="Anda sudah melakukan screening hari ini.",
            recommendation=rec
        )

    # 3. Panggil ML server (dengan fallback otomatis jika tidak tersedia)
    ml_result     = await call_ml_predict(req.frames)
    fatigue_score = ml_result["fatigue_score"]

    # 4. Hitung risk score gabungan
    risk_score = calculate_risk_score(
        fatigue_score=fatigue_score,
        sleep_hours=req.self_report.sleep_hours,
        energy_level=req.self_report.energy_level
    )

    status, message, recommendation = determine_status(risk_score)

    # 5. Simpan ke database
    screening = ScreeningResult(
        employee_id         = req.employee_id,
        fatigue_score       = fatigue_score,
        ear_avg             = ml_result.get("ear_avg"),
        mar_avg             = ml_result.get("mar_avg"),
        yawn_detected       = ml_result.get("yawn_detected", False),
        sleep_hours         = req.self_report.sleep_hours,
        energy_level        = req.self_report.energy_level,
        physical_complaints = req.self_report.physical_complaints,
        risk_score          = risk_score,
        status              = status,
        flagged             = (status == "not_fit")
    )
    db.add(screening)
    db.commit()
    db.refresh(screening)

    return ScreeningResponse(
        status=status,
        risk_score=risk_score,
        fatigue_score=fatigue_score,
        message=message,
        recommendation=recommendation
    )


@router.get("/history/{employee_id}")
def get_history(
    employee_id: int,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    results = (
        db.query(ScreeningResult)
        .filter(ScreeningResult.employee_id == employee_id)
        .order_by(ScreeningResult.screening_date.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "date":          r.screening_date,
            "status":        r.status,
            "risk_score":    r.risk_score,
            "fatigue_score": r.fatigue_score,
            "sleep_hours":   r.sleep_hours,
            "energy_level":  r.energy_level,
        }
        for r in results
    ]