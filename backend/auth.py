import os
from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from models import User, UserRole

# Secret key to sign JWT tokens
SECRET_KEY = os.getenv("SECRET_KEY", "SUPER_SECRET_KEY_REPLACE_IN_PRODUCTION")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days for demo

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, session_id: str, platform: str = "web", expires_delta: Optional[timedelta] = None):
    """
    Create a signed JWT that embeds a unique session_id ('sid' claim) and 'platform' claim.
    Only tokens whose 'sid' matches the user's platform-specific session_id in the DB
    will be accepted by get_current_user.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "sid": session_id, "platform": platform})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

class SessionExpiredException(Exception):
    pass

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Validates the JWT token AND enforces single-active-session per platform by comparing
    the 'sid' claim inside the token against the platform's session_id stored
    in the database. A mismatch means the account logged in elsewhere on the same platform.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_session_id: str = payload.get("sid")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await User.find_one(User.email == email)
    if user is None:
        raise credentials_exception

    if user.is_system_admin or not user.login_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System Admin login is disabled."
        )

    # --- Session enforcement ---
    # ADMIN role: no session restrictions — can login from unlimited devices simultaneously.
    # USER & SUPER_ADMIN: platform-specific single-active-session enforced.
    if token_session_id is not None and user.role != UserRole.ADMIN:
        platform = payload.get("platform", "web")
        if platform == "mobile":
            expected_sid = user.mobile_session_id or user.current_session_id
            if expected_sid != token_session_id:
                raise SessionExpiredException()
        else:
            expected_sid = user.web_session_id or user.current_session_id
            if expected_sid != token_session_id:
                raise SessionExpiredException()

    # Track last activity (limit DB writes by updating at most once per 60 seconds)
    now = datetime.utcnow()
    if not user.last_activity_at or (now - user.last_activity_at).total_seconds() > 60:
        user.last_activity_at = now
        await user.save()

    return user

def check_role(roles: List[UserRole]):
    async def role_checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this resource"
            )
        return user
    return role_checker

async def logout_user_session(user: User, token: Optional[str]):
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            platform = payload.get("platform", "web")
            if platform == "mobile":
                user.mobile_session_id = None
            else:
                user.web_session_id = None
        except Exception:
            user.web_session_id = None
            user.mobile_session_id = None
    else:
        user.web_session_id = None
        user.mobile_session_id = None

    user.current_session_id = None
    await user.save()
