"""
Test configuration for LeanPilot backend.

Strategy:
- Unit tests: call functions/classes directly, no DB needed.
- Integration tests: use httpx.AsyncClient against the FastAPI app,
  with the get_db dependency overridden to provide a mocked async session
  and get_current_user / get_current_active_admin overridden to inject
  test users without hitting a real database.
"""
import os
import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

# Force debug mode so Settings accepts empty SECRET_KEY (generates ephemeral)
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-production")

from httpx import AsyncClient, ASGITransport

from app.core.config import Settings, get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    _fallback_attempts,
    _fallback_blacklist,
)
from app.models.user import UserRole


# ---------------------------------------------------------------------------
# Clear caches so test settings take effect
# ---------------------------------------------------------------------------
get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Test settings override
# ---------------------------------------------------------------------------
_test_settings = get_settings()


# ---------------------------------------------------------------------------
# Fake User objects (plain objects that mimic the User SQLAlchemy model)
# ---------------------------------------------------------------------------
class FakeUser:
    """Lightweight stand-in for app.models.user.User used in dependency overrides."""

    def __init__(
        self,
        *,
        id: int,
        email: str,
        full_name: str,
        role: UserRole,
        factory_id: int | None,
        is_active: bool = True,
        is_deleted: bool = False,
        hashed_password: str = "",
        failed_login_attempts: int = 0,
        locked_until=None,
        last_login_at=None,
        password_changed_at=None,
        language: str = "en",
        ai_consent: bool = False,
        marketing_consent: bool = False,
        privacy_policy_accepted_at=None,
        terms_accepted_at=None,
        consent_version=None,
    ):
        self.id = id
        self.email = email
        self.full_name = full_name
        self.role = role
        self.factory_id = factory_id
        self.is_active = is_active
        self.is_deleted = is_deleted
        self.hashed_password = hashed_password
        self.failed_login_attempts = failed_login_attempts
        self.locked_until = locked_until
        self.last_login_at = last_login_at
        self.password_changed_at = password_changed_at
        self.language = language
        self.ai_consent = ai_consent
        self.marketing_consent = marketing_consent
        self.privacy_policy_accepted_at = privacy_policy_accepted_at
        self.terms_accepted_at = terms_accepted_at
        self.consent_version = consent_version


# Pre-built test users
ADMIN_USER = FakeUser(
    id=1,
    email="admin@testfactory.com",
    full_name="Admin User",
    role=UserRole.ADMIN,
    factory_id=1,
)

OPERATOR_USER = FakeUser(
    id=2,
    email="operator@testfactory.com",
    full_name="Operator User",
    role=UserRole.OPERATOR,
    factory_id=1,
)

VIEWER_USER = FakeUser(
    id=3,
    email="viewer@testfactory.com",
    full_name="Viewer User",
    role=UserRole.VIEWER,
    factory_id=1,
)

# User from a *different* factory — used for tenant-isolation tests
OTHER_FACTORY_ADMIN = FakeUser(
    id=10,
    email="admin@otherfactory.com",
    full_name="Other Admin",
    role=UserRole.ADMIN,
    factory_id=2,
)


# ---------------------------------------------------------------------------
# Helper: generate a valid JWT for a FakeUser
# ---------------------------------------------------------------------------
def make_token(user: FakeUser, token_type: str = "access") -> str:
    """Return a signed JWT for the given fake user."""
    data = {
        "sub": str(user.id),
        "role": user.role.value,
        "fid": user.factory_id,
    }
    if token_type == "refresh":
        return create_refresh_token(data={"sub": str(user.id)})
    return create_access_token(data=data)


# ---------------------------------------------------------------------------
# Fixtures: mock DB session
# ---------------------------------------------------------------------------
@pytest.fixture()
def mock_db():
    """An AsyncMock that behaves like an AsyncSession."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.flush = AsyncMock()
    session.close = AsyncMock()
    session.add = MagicMock()
    session.delete = AsyncMock()
    return session


# ---------------------------------------------------------------------------
# Fixtures: async test client with dependency overrides
# ---------------------------------------------------------------------------
@pytest.fixture()
def app_with_admin(mock_db):
    """Return the FastAPI app with get_db and auth dependencies overridden for ADMIN."""
    from app.main import app
    from app.db.session import get_db
    from app.core.security import get_current_user, get_current_active_admin

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: ADMIN_USER
    app.dependency_overrides[get_current_active_admin] = lambda: ADMIN_USER

    yield app

    app.dependency_overrides.clear()


@pytest.fixture()
def app_with_operator(mock_db):
    """Return the FastAPI app with auth overridden for OPERATOR."""
    from app.main import app
    from app.db.session import get_db
    from app.core.security import get_current_user, get_current_active_admin

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: OPERATOR_USER
    # Do NOT override get_current_active_admin — let it enforce the real check

    yield app

    app.dependency_overrides.clear()


@pytest.fixture()
def app_with_viewer(mock_db):
    """Return the FastAPI app with auth overridden for VIEWER."""
    from app.main import app
    from app.db.session import get_db
    from app.core.security import get_current_user, get_current_active_admin

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: VIEWER_USER

    yield app

    app.dependency_overrides.clear()


@pytest.fixture()
def app_with_other_factory_admin(mock_db):
    """Return the FastAPI app with auth overridden for an admin from factory 2."""
    from app.main import app
    from app.db.session import get_db
    from app.core.security import get_current_user, get_current_active_admin

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: OTHER_FACTORY_ADMIN
    app.dependency_overrides[get_current_active_admin] = lambda: OTHER_FACTORY_ADMIN

    yield app

    app.dependency_overrides.clear()


@pytest.fixture()
def app_no_auth(mock_db):
    """Return the app with DB mocked but NO auth override (for testing real auth flow)."""
    from app.main import app
    from app.db.session import get_db

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db

    yield app

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Async HTTP clients (one per role)
# ---------------------------------------------------------------------------
@pytest.fixture()
async def admin_client(app_with_admin):
    transport = ASGITransport(app=app_with_admin)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture()
async def operator_client(app_with_operator):
    transport = ASGITransport(app=app_with_operator)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture()
async def viewer_client(app_with_viewer):
    transport = ASGITransport(app=app_with_viewer)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture()
async def other_factory_client(app_with_other_factory_admin):
    transport = ASGITransport(app=app_with_other_factory_admin)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture()
async def anon_client(app_no_auth):
    transport = ASGITransport(app=app_no_auth)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# ---------------------------------------------------------------------------
# Fixtures: authenticated headers (JWT in Authorization header)
# ---------------------------------------------------------------------------
@pytest.fixture()
def admin_headers() -> dict[str, str]:
    """Return Authorization headers with a valid admin JWT."""
    token = make_token(ADMIN_USER)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def operator_headers() -> dict[str, str]:
    """Return Authorization headers with a valid operator JWT."""
    token = make_token(OPERATOR_USER)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def viewer_headers() -> dict[str, str]:
    """Return Authorization headers with a valid viewer JWT."""
    token = make_token(VIEWER_USER)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Fixtures: test factory (a plain dict matching Factory model shape)
# ---------------------------------------------------------------------------
class FakeFactory:
    """Lightweight stand-in for app.models.factory.Factory."""

    def __init__(self, *, id: int = 1, name: str = "Test Factory", slug: str = "test-factory"):
        self.id = id
        self.name = name
        self.slug = slug
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)


TEST_FACTORY = FakeFactory(id=1, name="Test Factory", slug="test-factory")
OTHER_FACTORY = FakeFactory(id=2, name="Other Factory", slug="other-factory")


@pytest.fixture()
def test_factory():
    """Return a FakeFactory for use in tests."""
    return TEST_FACTORY


@pytest.fixture()
def other_factory():
    """Return a second FakeFactory for tenant-isolation tests."""
    return OTHER_FACTORY


# ---------------------------------------------------------------------------
# Cleanup: clear in-memory rate-limit / blacklist state between tests
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def _clean_security_state():
    """Reset in-memory rate-limit buckets and token blacklist between tests."""
    _fallback_attempts.clear()
    _fallback_blacklist.clear()
    yield
    _fallback_attempts.clear()
    _fallback_blacklist.clear()
