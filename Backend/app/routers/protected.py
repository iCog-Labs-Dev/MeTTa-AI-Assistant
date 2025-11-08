from fastapi import APIRouter, Depends
from app.db.users import UserRole
from app.dependencies import require_role

router = APIRouter(
    prefix="/api/protected",
    tags=["protected"],
    responses={403: {"description": "Forbidden"}},
)


@router.get("/admin-only")
async def admin_only(
    _: None = Depends(require_role(UserRole.ADMIN)),
):
    return {"message": "Admin only route"}
