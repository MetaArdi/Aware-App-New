from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── Auth ─────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    employee_number: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    employee_id: Optional[int] = None
    name: Optional[str] = None


# ── Screening ────────────────────────────────────────────────────────
class SelfReport(BaseModel):
    sleep_hours: float = 7.0
    energy_level: int = 3
    physical_complaints: Optional[str] = None


class ScreeningRequest(BaseModel):
    employee_id: int
    frames: List[str]           # base64 images
    self_report: SelfReport


class ScreeningResponse(BaseModel):
    status: str                 # fit | at_risk | not_fit
    risk_score: float
    fatigue_score: float
    message: str
    recommendation: str


# ── Employee ─────────────────────────────────────────────────────────
class EmployeeCreate(BaseModel):
    name:            str
    employee_number: str
    email:           Optional[str] = None
    password:        str
    division:        str
    shift:           str
    role:            str = "employee"


class EmployeeStatusItem(BaseModel):
    employee_id:      int
    name:             str
    division:         str
    shift:            str
    status:           Optional[str] = None
    risk_score:       Optional[float] = None
    risk_score_label: Optional[str] = None
    screening_time:   Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Dashboard ────────────────────────────────────────────────────────
class DashboardSummary(BaseModel):
    total_employees: int
    screened_today:  int
    fit:             int
    at_risk:         int
    not_fit:         int
    pending:         int


class HistoryItem(BaseModel):
    date:          datetime
    status:        str
    risk_score:    float
    fatigue_score: float
    sleep_hours:   Optional[float] = None
    energy_level:  Optional[int] = None

    class Config:
        from_attributes = True