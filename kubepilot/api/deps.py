from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.orm import Session

from kubepilot.db.session import get_engine, make_session_factory


def get_db() -> Generator[Session, None, None]:
    factory = make_session_factory(get_engine())
    db = factory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
