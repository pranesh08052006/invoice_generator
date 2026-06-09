from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from models import User, UserRole

# Secret key to sign JWT tokens
SECRET_KEY = "SUPER_SECRET_KEY_REPLACE_IN_PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days for demo

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, session_id: str, expires_delta: Optional[timedelta] = None):
    """
    Create a signed JWT that embeds a unique session_id ('sid' claim).
    Only tokens whose 'sid' matches the user's current_session_id in the DB
    will be accepted by get_current_user.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "sid": session_id})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

class SessionExpiredException(Exception):
    pass

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Validates the JWT token AND enforces single-active-session by comparing
    the 'sid' claim inside the token against the current_session_id stored
    in the database.  A mismatch means the account logged in elsewhere.
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

    # --- Single-active-session enforcement ---
    # Enforced for all user roles (Super Admin, Admin, and User) to prevent concurrent logins.
    if token_session_id is not None:
        if user.current_session_id != token_session_id:
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
