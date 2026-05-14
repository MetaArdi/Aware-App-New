from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
from models.database import get_db, User, Employee, ScreeningResult
from schemas.schemas import EmployeeCreate
from core.auth import hash_password, require_role

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.post("/", status_code=201)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor"))
):
    if db.query(User).filter(User.employee_number == data.employee_number).first():
        raise HTTPException(status_code=409, detail="Nomor ID sudah terdaftar")

    user = User(
        employee_number=data.employee_number,
        email=data.email,
        password=hash_password(data.password),
        role=data.role
    )
    db.add(user)
    db.flush()

    emp = Employee(
        user_id=user.id,
        name=data.name,
        division=data.division,
        shift=data.shift
    )
    db.add(emp)
    db.commit()
    return {"message": "Karyawan berhasil ditambahkan", "employee_id": emp.id}


@router.get("/status")
def get_all_status(
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor", "admin"))
):
    today_start = datetime.combine(date.today(), datetime.min.time())
    employees   = db.query(Employee).all()
    result      = []

    for emp in employees:
        latest = (
            db.query(ScreeningResult)
            .filter(
                ScreeningResult.employee_id    == emp.id,
                ScreeningResult.screening_date >= today_start
            )
            .order_by(ScreeningResult.screening_date.desc())
            .first()
        )
        risk_score_raw     = latest.risk_score if latest else None
        risk_score_display = (
            f"{round(risk_score_raw * 100)}/100"
            if risk_score_raw is not None else None
        )

        result.append({
            "employee_id":      emp.id,
            "name":             emp.name,
            "division":         emp.division,
            "shift":            emp.shift,
            "status":           latest.status if latest else None,
            "risk_score":       risk_score_raw,
            "risk_score_label": risk_score_display,
            "screening_time":   latest.screening_date if latest else None,
        })

    return result


@router.patch("/{employee_id}/flag")
def flag_employee(
    employee_id: int,
    note: str,
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor", "admin"))
):
    today_start = datetime.combine(date.today(), datetime.min.time())
    screening   = (
        db.query(ScreeningResult)
        .filter(
            ScreeningResult.employee_id    == employee_id,
            ScreeningResult.screening_date >= today_start
        )
        .order_by(ScreeningResult.screening_date.desc())
        .first()
    )
    if not screening:
        raise HTTPException(status_code=404, detail="Data screening hari ini tidak ditemukan")

    screening.flagged         = True
    screening.supervisor_note = note
    db.commit()
    return {"message": "Karyawan berhasil di-flag"}