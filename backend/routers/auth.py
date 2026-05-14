from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db, User
from schemas.schemas import LoginRequest, TokenResponse
from core.auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.employee_number == req.employee_number
    ).first()

    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="ID atau kata sandi salah")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Akun tidak aktif")

    token = create_access_token({"sub": user.id, "role": user.role})

    employee_id = None
    name        = None
    if user.employee:
        employee_id = user.employee.id
        name        = user.employee.name

    return TokenResponse(
        access_token=token,
        role=user.role,
        employee_id=employee_id,
        name=name
    )


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id":              current_user.id,
        "employee_number": current_user.employee_number,
        "email":           current_user.email,
        "role":            current_user.role,
        "name":            current_user.employee.name if current_user.employee else None
    }