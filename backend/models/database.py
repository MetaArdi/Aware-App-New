from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    DateTime, Boolean, Text, ForeignKey, Enum
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from core.config import DATABASE_URL

# Gunakan check_same_thread=False hanya untuk SQLite
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine       = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base         = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    employee_number = Column(String(50), unique=True, nullable=False)
    email           = Column(String(150), unique=True, nullable=True)
    password        = Column(String(255), nullable=False)
    role            = Column(Enum("employee", "supervisor", "admin"), default="employee")
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="user", uselist=False)


class Employee(Base):
    __tablename__ = "employees"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), unique=True)
    name       = Column(String(150), nullable=False)
    division   = Column(String(100))
    shift      = Column(String(50))
    photo_url  = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user       = relationship("User", back_populates="employee")
    screenings = relationship("ScreeningResult", back_populates="employee")


class ScreeningResult(Base):
    __tablename__ = "screening_results"
    id                  = Column(Integer, primary_key=True, index=True)
    employee_id         = Column(Integer, ForeignKey("employees.id"))
    screening_date      = Column(DateTime, default=datetime.utcnow)
    fatigue_score       = Column(Float)
    ear_avg             = Column(Float, nullable=True)
    mar_avg             = Column(Float, nullable=True)
    yawn_detected       = Column(Boolean, default=False)
    sleep_hours         = Column(Float, nullable=True)
    energy_level        = Column(Integer, nullable=True)
    physical_complaints = Column(Text, nullable=True)
    risk_score          = Column(Float)
    status              = Column(Enum("fit", "at_risk", "not_fit"))
    supervisor_note     = Column(Text, nullable=True)
    flagged             = Column(Boolean, default=False)

    employee = relationship("Employee", back_populates="screenings")