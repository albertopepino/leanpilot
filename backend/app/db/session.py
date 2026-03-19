from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_for_rls(factory_id: int | None = None, is_admin: bool = False):
    """Yield a DB session with Postgres RLS session variables set.

    This must be used inside a request context where the current user's
    factory_id and admin status are known.  It issues SET LOCAL so the
    variables are scoped to the current transaction and automatically
    cleared on commit/rollback.

    Usage in a FastAPI route::

        @router.get("/items")
        async def list_items(
            user=Depends(get_current_user),
            db: AsyncSession = Depends(get_db),
        ):
            await set_rls_context(db, user.factory_id, is_admin(user))
            ...
    """
    async with async_session() as session:
        try:
            await _apply_rls_settings(session, factory_id, is_admin)
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def set_rls_context(
    db: AsyncSession,
    factory_id: int | None,
    is_admin: bool = False,
) -> None:
    """Set Postgres RLS session variables on an existing session.

    Call this at the top of any route handler that needs tenant isolation
    via Row Level Security.  Uses SET LOCAL so the values only live for
    the current transaction.

    Args:
        db: The current async database session.
        factory_id: The authenticated user's factory_id (from JWT / user model).
        is_admin: Whether the user has admin privileges (bypasses RLS).
    """
    await _apply_rls_settings(db, factory_id, is_admin)


async def _apply_rls_settings(
    session: AsyncSession,
    factory_id: int | None,
    is_admin: bool,
) -> None:
    """Internal helper — execute SET LOCAL statements for RLS."""
    if factory_id is not None:
        await session.execute(
            text("SET LOCAL app.current_factory_id = :fid"),
            {"fid": str(factory_id)},
        )
    if is_admin:
        await session.execute(text("SET LOCAL app.is_admin = 'true'"))
    else:
        await session.execute(text("SET LOCAL app.is_admin = 'false'"))
