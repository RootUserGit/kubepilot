from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from kubepilot.core.settings import Settings, get_settings
from kubepilot.db.base import Base


def make_engine(settings: Settings | None = None):
    settings = settings or get_settings()
    return create_engine(settings.database_url, pool_pre_ping=True)


def make_session_factory(engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = make_engine()
    return _engine


@contextmanager
def session_scope(settings: Settings | None = None) -> Generator[Session, None, None]:
    engine = make_engine(settings) if settings is not None else get_engine()
    factory = make_session_factory(engine)
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def create_all(engine) -> None:
    Base.metadata.create_all(bind=engine)
