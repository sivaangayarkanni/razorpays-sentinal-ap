"""is_mock_mode should use real Razorpay when keys are present and mock is false."""
from __future__ import annotations

import os

from app.core.config import get_settings
from app.services.razorpay_client import is_mock_mode


def _restore(env: dict[str, str | None]) -> None:
    for key, value in env.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    get_settings.cache_clear()


def _swap(**kwargs: str) -> dict[str, str | None]:
    previous = {key: os.environ.get(key) for key in kwargs}
    for key, value in kwargs.items():
        os.environ[key] = value
    get_settings.cache_clear()
    return previous


def test_mock_when_keys_missing():
    prev = _swap(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="", RAZORPAY_MOCK="false")
    try:
        assert is_mock_mode() is True
    finally:
        _restore(prev)


def test_real_mode_when_keys_present_and_mock_false():
    prev = _swap(
        RAZORPAY_KEY_ID="rzp_test_examplekeyid",
        RAZORPAY_KEY_SECRET="test_secret_value",
        RAZORPAY_MOCK="false",
    )
    try:
        assert is_mock_mode() is False
    finally:
        _restore(prev)


def test_explicit_mock_wins_even_with_keys():
    prev = _swap(
        RAZORPAY_KEY_ID="rzp_test_examplekeyid",
        RAZORPAY_KEY_SECRET="test_secret_value",
        RAZORPAY_MOCK="true",
    )
    try:
        assert is_mock_mode() is True
    finally:
        _restore(prev)
