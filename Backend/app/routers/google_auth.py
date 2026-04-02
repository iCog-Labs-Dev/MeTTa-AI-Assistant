from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
from urllib.parse import quote
from pymongo.database import Database
from app.dependencies import get_mongo_db
from app.services.auth import create_access_token, create_refresh_token
from app.core.utils.helpers import get_required_env
from bson import ObjectId
import httpx
import os

router = APIRouter(prefix="/api/auth", tags=["google-auth"])

GOOGLE_CLIENT_ID     = get_required_env("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = get_required_env("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI  = get_required_env("GOOGLE_REDIRECT_URI")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:5173")

@router.get("/google")
async def google_login():
    params = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
    )
    return RedirectResponse(params)


@router.get("/google/callback")
async def google_callback(code: str, mongo_db: Database = Depends(get_mongo_db)):
    # 1. Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
    token_data = token_res.json()
    if "error" in token_data:
        raise HTTPException(status_code=400, detail=token_data["error"])

    # 2. Get user profile from Google
    async with httpx.AsyncClient() as client:
        profile_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
    profile = profile_res.json()
    email     = profile["email"]
    google_id = profile["id"]
    name      = profile.get("name", "")

    ALLOWED_DOMAINS = ["singularitynet.io"] 

    email_domain = email.split("@")[-1].lower()
    if email_domain not in ALLOWED_DOMAINS:
        return RedirectResponse(
            f"{FRONTEND_URL}/login?error=unauthorized_domain&domain={email_domain}",
            status_code=302
        )

    # 3. Find or create user in MongoDB
    users = mongo_db["users"]
    user  = await users.find_one({"email": email})

    if not user:
        result = await users.insert_one({
            "email":     email,
            "name":      name,
            "google_id": google_id,
            "role":      "user",
            "auth_provider": "google",
        })
        user_id = str(result.inserted_id)
    else:
        user_id = str(user["_id"])
        # update google_id if missing
        if not user.get("google_id"):
            await users.update_one(
                {"_id": user["_id"]},
                {"$set": {"google_id": google_id, "auth_provider": "google"}}
            )

    role = user["role"] if user else "user"

    # 4. Issue our own JWT (same format as email login)
    access_token  = create_access_token({"sub": user_id, "role": role})
    refresh_token = create_refresh_token({"sub": user_id, "role": role})

    # 5. Redirect frontend to callback page with token in URL
    redirect_url = (
    f"{FRONTEND_URL}/auth/callback"
    f"?access_token={access_token}"
    f"&refresh_token={refresh_token}"
    f"&email={quote(email)}"
    )
    print(f"REDIRECTING TO: {redirect_url}")  # ← add this
    return RedirectResponse(redirect_url, status_code=302)