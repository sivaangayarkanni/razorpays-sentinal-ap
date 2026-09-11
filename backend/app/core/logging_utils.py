"""Structured logging helpers — request_id, intent_id, gate, outcome."""
from __future__ import annotations

import json
import logging
from typing import Any, Optional


def get_logger(name: str = "sentinel-ap") -> logging.Logger:
    return logging.getLogger(name)


def structured_log(
    logger: logging.Logger,
    level: int,
    message: str,
    *,
    request_id: Optional[str] = None,
    intent_id: Optional[str] = None,
    gate: Optional[str] = None,
    outcome: Optional[str] = None,
    reason_code: Optional[str] = None,
    **extra: Any,
) -> None:
    payload: dict[str, Any] = {"msg": message}
    if request_id:
        payload["request_id"] = request_id
    if intent_id:
        payload["intent_id"] = intent_id
    if gate:
        payload["gate"] = gate
    if outcome:
        payload["outcome"] = outcome
    if reason_code:
        payload["reason_code"] = reason_code
    if extra:
        payload.update(extra)
    logger.log(level, json.dumps(payload, default=str, separators=(",", ":")))
