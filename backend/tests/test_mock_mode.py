"""RAZORPAY_MOCK must never invent orders, even when keys are missing."""
from __future__ import annotations

import os

from app.core.config import get_settings
from app.services.razorpay_client import is_mock_mode, razorpay_client


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


def test_is_mock_mode_false_when_keys_missing():
    prev = _swap(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="", RAZORPAY_MOCK="true", ENABLE_DEMO="true")
    try:
        assert is_mock_mode() is False
    finally:
        _restore(prev)


def test_is_mock_mode_false_when_keys_present():
    prev = _swap(
        RAZORPAY_KEY_ID="rzp_test_examplekeyid",
        RAZORPAY_KEY_SECRET="test_secret_value",
        RAZORPAY_MOCK="true",
        ENABLE_DEMO="true",
    )
    try:
        assert is_mock_mode() is False
    finally:
        _restore(prev)


def test_verify_rejects_mock_signatures():
    prev = _swap(RAZORPAY_KEY_ID="rzp_test_examplekeyid", RAZORPAY_KEY_SECRET="test_secret_value")
    try:
        result = razorpay_client.verify_payment_signature(
            order_id="order_mock_abcdef",
            payment_id="pay_mock_abcdef",
            signature="mock_signature",
        )
        assert result.success is False
        assert "Mock" in (result.error or "")
    finally:
        _restore(prev)


def test_status_is_never_mock():
    prev = _swap(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="", RAZORPAY_MOCK="true")
    try:
        status = razorpay_client.get_status()
        assert status.mock is False
        assert status.keys_configured is False
        assert status.mode == "unconfigured"
    finally:
        _restore(prev)
