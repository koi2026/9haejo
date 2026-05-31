"""
Simple in-memory TTL cache for API responses.
"""
import time
from typing import Any, Optional


class TTLCache:
    def __init__(self, ttl: int = 60):
        self._store: dict[str, tuple[float, Any, int]] = {}
        self._default_ttl = ttl

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        ts, val, ttl = entry
        if time.time() - ts > ttl:
            del self._store[key]
            return None
        return val

    def set(self, key: str, val: Any, ttl: Optional[int] = None):
        actual_ttl = ttl if ttl is not None else self._default_ttl
        self._store[key] = (time.time(), val, actual_ttl)

    def clear(self):
        self._store.clear()

    def invalidate(self, key: str):
        self._store.pop(key, None)


# shared instances
quote_cache    = TTLCache(ttl=60)    # 1 min: stock quotes
news_cache     = TTLCache(ttl=300)   # 5 min: news / API results
analysis_cache = TTLCache(ttl=600)   # 10 min: heavy analysis (sector, ETF, momentum)
