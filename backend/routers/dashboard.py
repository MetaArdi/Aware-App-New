from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from models.database import get_db, ScreeningResult, Employee
from schemas.schemas import DashboardSummary
from core.auth import require_role

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor", "admin"))
):
    today_start = datetime.combine(date.today(), datetime.min.time())
    total_emp   = db.query(Employee).count()

    statuses = (
        db.query(ScreeningResult.status, func.count())
        .filter(ScreeningResult.screening_date >= today_start)
        .group_by(ScreeningResult.status)
        .all()
    )
    counts = {s: c for s, c in statuses}

    fit      = counts.get("fit", 0)
    at_risk  = counts.get("at_risk", 0)
    not_fit  = counts.get("not_fit", 0)
    screened = fit + at_risk + not_fit

    return DashboardSummary(
        total_employees=total_emp,
        screened_today=screened,
        fit=fit,
        at_risk=at_risk,
        not_fit=not_fit,
        pending=total_emp - screened
    )


@router.get("/trend")
def get_trend(
    days: int = 7,
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor", "admin"))
):
    labels, fit_data, at_risk_data, not_fit_data = [], [], [], []

    for i in range(days - 1, -1, -1):
        target_date = date.today() - timedelta(days=i)
        start = datetime.combine(target_date, datetime.min.time())
        end   = datetime.combine(target_date, datetime.max.time())

        rows = (
            db.query(ScreeningResult.status, func.count())
            .filter(ScreeningResult.screening_date.between(start, end))
            .group_by(ScreeningResult.status)
            .all()
        )
        c = {s: n for s, n in rows}
        labels.append(target_date.strftime("%d/%m"))
        fit_data.append(c.get("fit", 0))
        at_risk_data.append(c.get("at_risk", 0))
        not_fit_data.append(c.get("not_fit", 0))

    return {
        "labels": labels,
        "datasets": {
            "fit":     fit_data,
            "at_risk": at_risk_data,
            "not_fit": not_fit_data
        }
    }