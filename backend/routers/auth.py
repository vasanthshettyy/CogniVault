"""
CogniVault - Authentication Router
POST /api/auth/register - Create a new user account.
POST /api/auth/login    - Authenticate and return JWT.
"""

import re
import os
import hashlib
from fastapi import APIRouter, HTTPException, status
from models.schemas import UserRegister, UserLogin
from utils.jwt_handler import create_access_token
from db.supabase_client import get_supabase

router = APIRouter()

def hash_password(password: str, salt: bytes = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ":" + pwd_hash.hex()

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, hash_hex = stored_hash.split(':')
        salt = bytes.fromhex(salt_hex)
        pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return pwd_hash.hex() == hash_hex
    except Exception:
        return False


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister):
    """
    Register a new user account.

    Validates:
    - Name: 2-100 chars, no numbers
    - Email: valid format, not already registered
    - Password: min 8 chars, 1 uppercase, 1 digit

    Returns:
        201: Account created with user_id and name.
        400: Validation error or email already exists.
    """
    # Validate name (no numbers)
    if re.search(r'\d', user.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name must not contain numbers"
        )

    # Validate password complexity
    if not re.search(r'[A-Z]', user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter"
        )
    if not re.search(r'\d', user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one digit"
        )

    try:
        supabase = get_supabase()

        # Check if email already exists
        existing = supabase.table("users").select("id").eq("email", user.email).execute()
        if existing.data and len(existing.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Hash password
        password_hash = hash_password(user.password)

        # Insert user
        insert_data = {
            "name": user.name.strip(),
            "email": user.email.lower().strip(),
            "password_hash": password_hash,
        }
        if user.gender:
            insert_data["gender"] = user.gender

        result = supabase.table("users").insert(insert_data).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create account"
            )

        new_user = result.data[0]
        return {
            "status": "success",
            "message": "Account created successfully",
            "data": {
                "user_id": new_user["id"],
                "name": new_user["name"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login")
async def login(user: UserLogin):
    """
    Authenticate a user and return a JWT token.

    Returns:
        200: Login successful with access_token, user_id, name.
        401: Invalid email or password.
    """
    try:
        supabase = get_supabase()

        # Find user by email
        result = supabase.table("users").select("*").eq("email", user.email.lower().strip()).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        db_user = result.data[0]

        # Verify password
        if not verify_password(user.password, db_user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Generate JWT
        token = create_access_token(db_user["id"], db_user["email"])

        return {
            "status": "success",
            "message": "Login successful",
            "data": {
                "access_token": token,
                "token_type": "bearer",
                "user_id": db_user["id"],
                "name": db_user["name"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )
