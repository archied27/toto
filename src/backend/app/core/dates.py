"""
shared date parsing: turns natural-language date phrases into YYYY-MM-DD.
"""

import logging
from datetime import date, timedelta
from typing import Optional

import dateparser

logger = logging.getLogger(__name__)

_WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

_WEEKEND_PHRASES = (
    "weekend",
    "this weekend",
    "the weekend",
    "this coming weekend",
    "the coming weekend",
)


def _weekday_ahead(weekday: str, weeks: int = 0) -> str:
    """ISO date of the next occurrence of *weekday*, `weeks` weeks ahead."""
    today = date.today()
    days = ((_WEEKDAYS[weekday] - today.weekday()) % 7) + 7 * weeks
    return (today + timedelta(days=days)).isoformat()


def _resolve_relative(value: str) -> Optional[str]:
    """Resolve 'this/next <weekday>' and 'weekend' phrases that dateparser misses."""
    v = value.lower().strip()
    if v in _WEEKEND_PHRASES:
        return _weekday_ahead("saturday")
    if v == "next weekend":
        return _weekday_ahead("saturday", 1)
    for marker, weeks in (("this ", 0), ("next ", 1)):
        if v.startswith(marker):
            weekday = v[len(marker):].strip()
            if weekday in _WEEKDAYS:
                return _weekday_ahead(weekday, weeks)
    return None


def parse_date(value: Optional[str]) -> Optional[str]:
    """Turn a date phrase into YYYY-MM-DD, or None if it can't be understood.

    Already-ISO values pass through untouched; natural-language phrases go
    through dateparser (preferring future dates, DMY order). Never raises, so a
    bad date from the LLM can't crash a plugin.
    """
    value = (value or "").strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        pass
    relative = _resolve_relative(value)
    if relative:
        return relative
    parsed = dateparser.parse(
        value,
        settings={"PREFER_DATES_FROM": "future", "DATE_ORDER": "DMY"},
    )
    if parsed is None:
        # DMY fails on some formats (e.g. ISO datetimes) — let dateparser
        # auto-detect the order as a fallback.
        parsed = dateparser.parse(value, settings={"PREFER_DATES_FROM": "future"})
    if parsed is None:
        logger.warning("Could not parse date %r; leaving empty", value)
        return None
    return parsed.date().isoformat()
