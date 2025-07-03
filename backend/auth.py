import json
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable must be set for security")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")

def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r") as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_user(username: str):
    users = load_users()
    return users.get(username)

def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user or not user.get("hashed_password"):
        return False
    if not verify_password(password, user["hashed_password"]):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(username)
    if user is None:
        raise credentials_exception
    return user

def must_change_password(username: str):
    user = get_user(username)
    return user and user.get("must_change", False)

def set_new_user(username: str, password: str, security_question: str = None, security_answer: str = None):
    users = load_users()
    if username in users and not users[username].get("must_change", False):
        raise Exception("User already exists")
    if len(username) < 5:
        raise Exception("Username zu kurz")
    if len(password) < 8:
        raise Exception("Passwort zu kurz")
    hashed = pwd_context.hash(password)
    user_obj = {
        "username": username,
        "hashed_password": hashed,
        "must_change": False
    }
    if security_question and security_answer:
        user_obj["security_question"] = security_question
        user_obj["security_answer"] = pwd_context.hash(security_answer)
    users[username] = user_obj
    # Entferne ggf. alten admin-User
    if "admin" in users and users["admin"].get("must_change", False):
        del users["admin"]
    save_users(users)
    return True

def get_security_question(username: str):
    user = get_user(username)
    if user and user.get("security_question"):
        return user["security_question"]
    return None

def verify_security_answer(username: str, answer: str):
    user = get_user(username)
    if user and user.get("security_answer"):
        return pwd_context.verify(answer, user["security_answer"])
    return False

def reset_password(username: str, answer: str, new_password: str):
    users = load_users()
    user = users.get(username)
    if not user:
        raise Exception("User not found")
    if not user.get("security_answer"):
        raise Exception("No security question set for this user")
    if not pwd_context.verify(answer, user["security_answer"]):
        raise Exception("Security answer incorrect")
    if len(new_password) < 8:
        raise Exception("Passwort zu kurz")
    user["hashed_password"] = pwd_context.hash(new_password)
    user["must_change"] = False
    save_users(users)
    return True
