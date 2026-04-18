from __future__ import annotations

import re
from contextlib import contextmanager
from typing import Any, Generator

import pymysql
from pymysql.cursors import DictCursor

from app.config import Settings

_IDENTIFIER = re.compile(r"^[a-zA-Z0-9_]+$")


def _validate_identifiers(parts: list[str], label: str) -> None:
    for p in parts:
        if not p or not _IDENTIFIER.match(p):
            raise ValueError(f"Invalid {label} identifier: {p!r}")


@contextmanager
def mysql_connection(settings: Settings) -> Generator[pymysql.connections.Connection, None, None]:
    conn = pymysql.connect(
        host=settings.mysql_host,
        port=settings.mysql_port,
        user=settings.mysql_user,
        password=settings.mysql_password,
        database=settings.mysql_database,
        cursorclass=DictCursor,
        charset="utf8mb4",
        connect_timeout=10,
        read_timeout=30,
        write_timeout=30,
    )
    try:
        yield conn
    finally:
        conn.close()


def fetch_orders(settings: Settings, limit: int = 200) -> list[dict[str, Any]]:
    table = settings.mysql_orders_table.strip()
    cols_raw = settings.mysql_orders_columns.strip()
    cols = [c.strip() for c in cols_raw.split(",") if c.strip()]
    _validate_identifiers([table], "table")
    _validate_identifiers(cols, "column")
    col_sql = ", ".join(cols)
    lim = max(1, min(limit, 500))
    sql = f"SELECT {col_sql} FROM `{table}` ORDER BY 1 DESC LIMIT %s"
    with mysql_connection(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (lim,))
            rows = cur.fetchall()
    return list(rows)
