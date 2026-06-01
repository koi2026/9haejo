"""
In-memory TTL + LRU cache for API responses.
v2: LRU eviction, hit/miss stats, max_size limit
"""
import time
from collections import OrderedDict
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)


class TTLCache:
    def __init__(self, ttl: int = 60, max_size: int = 512):
        self._store: OrderedDict[str, tuple[float, Any, int]] = OrderedDict()
        self._default_ttl = ttl
        self._max_size = max_size
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            self._misses += 1
            return None
        ts, val, ttl = entry
        if time.time() - ts > ttl:
            del self._store[key]
            self._misses += 1
            return None
        # LRU: move to end (most recently used)
        self._store.move_to_end(key)
        self._hits += 1
        return val

    def set(self, key: str, val: Any, ttl: Optional[int] = None):
        actual_ttl = ttl if ttl is not None else self._default_ttl
        if key in self._store:
            self._store.move_to_end(key)
        self._store[key] = (time.time(), val, actual_ttl)
        # Evict oldest if over limit
        while len(self._store) > self._max_size:
            evicted_key, _ = self._store.popitem(last=False)
            logger.debug("LRU evict: %s", evicted_key)

    def clear(self):
        self._store.clear()

    def invalidate(self, key: str):
        self._store.pop(key, None)

    def stats(self) -> dict:
        total = self._hits + self._misses
        hit_rate = round(self._hits / total * 100, 1) if total else 0
        return {
            "size": len(self._store),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate_pct": hit_rate,
            "ttl_default": self._default_ttl,
        }

    def purge_expired(self):
        """Remove all expired entries (call periodically to free memory)"""
        now = time.time()
        expired = [k for k, (ts, _, ttl) in self._store.items() if now - ts > ttl]
        for k in expired:
            del self._store[k]
        return len(expired)


# shared instances
quote_cache    = TTLCache(ttl=60,  max_size=256)  # 1 min: stock quotes
news_cache     = TTLCache(ttl=300, max_size=128)  # 5 min: news / API results
analysis_cache = TTLCache(ttl=600, max_size=128)  # 10 min: heavy analysis
