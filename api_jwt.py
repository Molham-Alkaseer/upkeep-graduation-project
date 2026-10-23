"""JWT access tokens and Bearer auth for /api/v1 routes.

After a successful @require_api_jwt check:
- g.current_user_id — int
- g.api_user — loaded User instance (avoids clashing with flask_login.current_user)
"""
from __future__ import annotations

import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Callable, TypeVar

from flask import current_app, g, jsonify, request

from models import User

F = TypeVar("F", bound=Callable[..., Any])


def _jwt_secret() -> str:
    raw = current_app.config["SECRET_KEY"]
    if isinstance(raw, bytes):
        return raw.decode("utf-8")
    if raw is None or raw == "":
        raise ValueError("SECRET_KEY must be set for JWT")
    return str(raw)


def create_access_token(user_id: int) -> str:
    secret = _jwt_secret()
    days = int(current_app.config.get("JWT_EXPIRATION_DAYS", 7))
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=days)
    payload = {"sub": str(user_id), "exp": exp, "iat": now}
    token = jwt.encode(payload, secret, algorithm="HS256")
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])


def require_api_jwt(f: F) -> F:
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify(success=False, message="مطلوب رمز وصول صالح"), 401
        raw = auth_header[7:].strip()
        if not raw:
            return jsonify(success=False, message="مطلوب رمز وصول صالح"), 401
        try:
            payload = decode_access_token(raw)
        except jwt.ExpiredSignatureError:
            return jsonify(success=False, message="انتهت صلاحية الرمز"), 401
        except jwt.InvalidTokenError:
            return jsonify(success=False, message="رمز غير صالح"), 401
        sub = payload.get("sub")
        if sub is None:
            return jsonify(success=False, message="رمز غير صالح"), 401
        try:
            uid = int(sub)
        except (TypeError, ValueError):
            return jsonify(success=False, message="رمز غير صالح"), 401
        user = User.query.get(uid)
        if user is None:
            return jsonify(success=False, message="المستخدم غير موجود"), 401
        g.current_user_id = uid
        g.api_user = user
        return f(*args, **kwargs)

    return decorated  # type: ignore[return-value]
