from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from models.database import get_db, User, Notification
from models.schemas import NotificationResponse
from services.auth_service import get_current_user

router = APIRouter()


@router.get("", response_model=dict)
async def list_notifications(
    unread_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Notification).where(Notification.user_id == user.id)
    count_query = select(func.count(Notification.id)).where(Notification.user_id == user.id)

    if unread_only:
        query = query.where(Notification.read == False)
        count_query = count_query.where(Notification.read == False)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    notifications = [NotificationResponse.model_validate(n) for n in result.scalars().all()]

    unread_count = (await db.execute(
        select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.read == False)
    )).scalar() or 0

    return {"items": notifications, "total": total, "unread_count": unread_count, "page": page}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await db.execute(
        update(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        ).values(read=True)
    )
    await db.commit()
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await db.execute(
        update(Notification).where(
            Notification.user_id == user.id, Notification.read == False
        ).values(read=True)
    )
    await db.commit()
    return {"status": "ok"}
