from fastapi import FastAPI, Depends, HTTPException, status, Request, Form
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from datetime import timedelta
from auth import authenticate_user, create_access_token, get_current_user, must_change_password, set_new_user, get_security_question, reset_password
from routes import server_control
from fastapi.middleware.cors import CORSMiddleware
import re


def validate_username(username: str) -> bool:
    """Validate username: 5-20 characters, alphanumeric and underscore only"""
    return re.match(r'^[a-zA-Z0-9_]{5,20}$', username) is not None

def validate_password(password: str) -> bool:
    """Validate password: min 8 characters, contains letters and numbers"""
    return len(password) >= 8 and re.search(r'[A-Za-z]', password) and re.search(r'\d', password)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Trusted Host Middleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "*.localhost"])

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:1105",  # <-- Füge das hinzu!
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(server_control.router)

@app.post("/login")
@limiter.limit("5/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user["username"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change": user.get("must_change", False)
    }

@app.post("/change_user")
def change_user(
    username: str = Form(...),
    password: str = Form(...),
    security_question: str = Form(...),
    security_answer: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    # Validierung
    if not validate_username(username):
        raise HTTPException(status_code=400, detail="Username must be 5-20 characters long and contain only letters, numbers, and underscores")
    if not validate_password(password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters and contain letters and numbers")
    if not security_question or not security_answer:
        raise HTTPException(status_code=400, detail="Sicherheitsfrage und Antwort sind erforderlich")
    # Erlaubt, wenn must_change oder explizit gewünscht (z.B. Settings)
    if not current_user.get("must_change", False) and current_user["username"] == username:
        raise HTTPException(status_code=400, detail="Neuer Username muss sich vom alten unterscheiden")
    try:
        set_new_user(username, password, security_question, security_answer)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "User, Passwort & Sicherheitsfrage geändert"}

# Endpunkt: Sicherheitsfrage abfragen
from pydantic import BaseModel

class UsernameRequest(BaseModel):
    username: str

@app.post("/get_security_question")
def api_get_security_question(request: UsernameRequest):
    question = get_security_question(request.username)
    if not question:
        raise HTTPException(status_code=404, detail="Keine Sicherheitsfrage für diesen Benutzer")
    return {"security_question": question}

# Endpunkt: Passwort zurücksetzen
@app.post("/reset_password")
def api_reset_password(
    username: str = Form(...),
    security_answer: str = Form(...),
    new_password: str = Form(...)
):
    if not validate_password(new_password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters and contain letters and numbers")
    try:
        reset_password(username, security_answer, new_password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Passwort erfolgreich zurückgesetzt"}
@app.post("/change_password")
def change_password(
    old_password: str = Form(...),
    new_password: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    if not validate_password(new_password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters and contain letters and numbers")
    
    from auth import load_users, save_users, pwd_context
    users = load_users()
    user = users.get(current_user["username"])
    if not user or not pwd_context.verify(old_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Altes Passwort falsch")
    user["hashed_password"] = pwd_context.hash(new_password)
    save_users(users)
    return {"message": "Passwort geändert"}

@app.post("/change_username")
def change_username(
    new_username: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    if not validate_username(new_username):
        raise HTTPException(status_code=400, detail="Username must be 5-20 characters long and contain only letters, numbers, and underscores")
    
    from auth import load_users, save_users
    users = load_users()
    if new_username in users:
        raise HTTPException(status_code=400, detail="Username existiert bereits")
    user = users.pop(current_user["username"])
    user["username"] = new_username
    users[new_username] = user
    save_users(users)
    return {"message": "Username geändert"}

@app.get("/me")
def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

@app.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    # In einer Produktionsumgebung würden Sie hier das Token zur Blacklist hinzufügen
    return {"message": "Successfully logged out"}
