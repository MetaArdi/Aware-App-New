from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from models.database import get_db, Notification, User
from core.auth import get_current_user
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/notifications", tags=["Notifications"])

class NotificationSchema(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime
    link: str | None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotificationSchema])
def get_notifications(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()

@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notifikasi tidak ditemukan")
    
    setattr(notif, "is_read", True)
    db.commit()
    return {"status": "success"}

@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db.query(Notification).filter(Notification.user_id == current_user.id).update({"is_read": True})
    db.commit()
    return {"status": "success"}
