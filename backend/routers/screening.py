from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, date
from models.database import get_db, ScreeningResult, Employee, User, Notification
from schemas.schemas import ScreeningRequest, ScreeningResponse, RealtimeScreeningRequest, RealtimeScreeningResponse
from services.ml_client import call_ml_predict, call_ml_realtime
from services.risk_scoring import calculate_risk_score, determine_status
from core.auth import get_current_user

router = APIRouter(prefix="/screening", tags=["Screening"])

@router.post("/realtime", response_model=RealtimeScreeningResponse)
async def analyze_realtime(
    req: RealtimeScreeningRequest,
    current_user: User = Depends(get_current_user)
):
    """Endpoint for realtime feedback during screening."""
    result = await call_ml_realtime(req.frame, config=req.config.dict() if req.config else None)
    return RealtimeScreeningResponse(
        ear=result.get("ear", 0.3),
        mar=result.get("mar", 0.1),
        face_detected=result.get("face_detected", False),
        landmarks=result.get("landmarks")
    )

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

    # 3. Panggil ML server (dengan fallback otomatis jika tidak tersedia)
    ml_result     = await call_ml_predict(req.frames, config=req.config.dict() if req.config else None)
    fatigue_score = ml_result["fatigue_score"]
    ear_avg       = ml_result.get("ear_avg", 0.3)
    yawn_count    = ml_result.get("yawn_count", 0)

    # 4. Hitung risk score gabungan (Fase Hybrid)
    risk_score = calculate_risk_score(
        fatigue_score=fatigue_score,
        sleep_hours=req.self_report.sleep_hours,
        energy_level=req.self_report.energy_level,
        ear_avg=ear_avg,
        yawn_count=yawn_count
    )

    status, message, recommendation = determine_status(risk_score)

    # 5. Simpan ke database
    screening = ScreeningResult(
        employee_id         = req.employee_id,
        fatigue_score       = fatigue_score,
        ear_avg             = ml_result.get("ear_avg"),
        mar_avg             = ml_result.get("mar_avg"),
        yawn_detected       = (yawn_count > 0),
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

    # 6. Kirim notifikasi ke Supervisor jika Not Fit
    if status == "not_fit":
        supervisors = db.query(User).filter(User.role == "supervisor").all()
        for sup in supervisors:
            notif = Notification(
                user_id=sup.id,
                title="ALERT: Kondisi Karyawan Tidak Fit",
                message=f"Karyawan {employee.name} (ID: {employee.user.employee_number}) terdeteksi tidak fit dengan skor risiko {risk_score:.2f}.",
                type="error",
                link=f"/employee/{employee.id}"
            )
            db.add(notif)
        db.commit()

    return ScreeningResponse(
        status=status,
        risk_score=risk_score,
        fatigue_score=fatigue_score,
        ear_avg=ml_result.get("ear_avg"),
        mar_avg=ml_result.get("mar_avg"),
        face_detected_count=ml_result.get("face_detected_count", 0),
        yawn_count=ml_result.get("yawn_count", 0),
        sleep_hours=req.self_report.sleep_hours,
        energy_level=req.self_report.energy_level,
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
            "id":            r.id,
            "date":          r.screening_date,
            "status":        r.status,
            "risk_score":    r.risk_score,
            "fatigue_score": r.fatigue_score,
            "sleep_hours":   r.sleep_hours,
            "energy_level":  r.energy_level,
            "supervisor_note": r.supervisor_note
        }
        for r in results
    ]
class NoteUpdate(BaseModel):
    note: str

@router.post("/{screening_id}/note")
def update_supervisor_note(
    screening_id: int,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["supervisor", "admin"]:
        raise HTTPException(status_code=403, detail="Hanya supervisor yang dapat memberikan catatan")
    
    screening = db.query(ScreeningResult).filter(ScreeningResult.id == screening_id).first()
    if not screening:
        raise HTTPException(status_code=404, detail="Data screening tidak ditemukan")
    
    screening.supervisor_note = payload.note
    
    # Kirim notifikasi ke karyawan (pemilik hasil asesmen)
    if screening.employee and screening.employee.user_id:
        new_notif = Notification(
            user_id=screening.employee.user_id,
            title="Pesan dari Supervisor",
            message=f"Supervisor memberikan instruksi: \"{payload.note}\"",
            type="info",
            link="/logs" # Arahkan ke Health Logs untuk melihat riwayat
        )
        db.add(new_notif)
    
    db.commit()
    return {"status": "success", "note": payload.note}
