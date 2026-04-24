from collections import OrderedDict
from threading import Lock
from typing import Literal

from google.cloud import translate_v2 as translate

Language = Literal["de", "en"]
SUPPORTED_LANGUAGES: set[Language] = {"de", "en"}

_CACHE_MAX = 512
_cache: "OrderedDict[tuple[str, str, str], str]" = OrderedDict()
_cache_lock = Lock()
_client: translate.Client | None = None


def _get_client() -> translate.Client:
    global _client
    if _client is None:
        _client = translate.Client()
    return _client


def _cache_get(key: tuple[str, str, str]) -> str | None:
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    return None


def _cache_put(key: tuple[str, str, str], value: str) -> None:
    with _cache_lock:
        _cache[key] = value
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)


def translate_text(text: str, source: Language, target: Language) -> str:
    text = text.strip()
    if not text:
        return ""
    if source == target:
        return text
    if source not in SUPPORTED_LANGUAGES or target not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language pair: {source}->{target}")

    key = (text, source, target)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    result = _get_client().translate(
        text,
        source_language=source,
        target_language=target,
        format_="text",
    )
    translated = result["translatedText"]
    _cache_put(key, translated)
    return translated
