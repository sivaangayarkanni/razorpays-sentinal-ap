"""Formal Intent state machine — single source of truth for allowed transitions.

Conceptual flow (persisted DecisionOutcome values stay API-compatible):

  PENDING → HARD_BLOCK | QUEUED | ALLOW | FAILED
  QUEUED  → CLEARED | FAILED | QUEUED (retry)
  ALLOW   → VERIFIED (logical; DB status may remain ALLOW)
  CLEARED → VERIFIED (logical)
  * terminal: HARD_BLOCK, FAILED, VERIFIED

VERIFIED is recorded via reason_code=PAYMENT_VERIFIED without changing the public
status enum used by playground/dashboard (ALLOW / CLEARED).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Iterable

from app.models.entities import DecisionOutcome, Intent


class IntentState(str, Enum):
    PENDING = "PENDING"
    HARD_BLOCK = "HARD_BLOCK"
    QUEUED = "QUEUED"
    ALLOW = "ALLOW"
    CLEARED = "CLEARED"
    FAILED = "FAILED"
    VERIFIED = "VERIFIED"  # logical post-payment; not always persisted as status


# Legal directed edges for persisted DecisionOutcome (+ PENDING start)
_TRANSITIONS: dict[IntentState, frozenset[IntentState]] = {
    IntentState.PENDING: frozenset(
        {
            IntentState.HARD_BLOCK,
            IntentState.QUEUED,
            IntentState.ALLOW,
            IntentState.FAILED,
        }
    ),
    IntentState.QUEUED: frozenset(
        {
            IntentState.CLEARED,
            IntentState.FAILED,
            IntentState.QUEUED,  # still degraded / re-enqueue
        }
    ),
    IntentState.ALLOW: frozenset(
        {
            IntentState.VERIFIED,
            IntentState.FAILED,
            IntentState.ALLOW,  # idempotent re-entry
        }
    ),
    IntentState.CLEARED: frozenset(
        {
            IntentState.VERIFIED,
            IntentState.CLEARED,
        }
    ),
    IntentState.HARD_BLOCK: frozenset(),  # terminal
    IntentState.FAILED: frozenset(),  # terminal
    IntentState.VERIFIED: frozenset({IntentState.VERIFIED}),  # idempotent
}

# Map logical states → DB DecisionOutcome (None = do not overwrite status)
_PERSISTED: dict[IntentState, DecisionOutcome | None] = {
    IntentState.PENDING: None,
    IntentState.HARD_BLOCK: DecisionOutcome.HARD_BLOCK,
    IntentState.QUEUED: DecisionOutcome.QUEUED,
    IntentState.ALLOW: DecisionOutcome.ALLOW,
    IntentState.CLEARED: DecisionOutcome.CLEARED,
    IntentState.FAILED: DecisionOutcome.FAILED,
    IntentState.VERIFIED: None,  # keep prior ALLOW/CLEARED
}


class InvalidTransition(ValueError):
    """Raised when code attempts an illegal intent status change."""


@dataclass(frozen=True)
class Transition:
    source: IntentState
    target: IntentState
    via: str


def allowed_targets(source: IntentState) -> frozenset[IntentState]:
    return _TRANSITIONS.get(source, frozenset())


def can_transition(source: IntentState, target: IntentState) -> bool:
    return target in allowed_targets(source)


def assert_transition(source: IntentState, target: IntentState, *, via: str = "") -> Transition:
    if not can_transition(source, target):
        raise InvalidTransition(
            f"Illegal intent transition {source.value} → {target.value}"
            + (f" via {via}" if via else "")
        )
    return Transition(source=source, target=target, via=via)


def outcome_to_state(outcome: DecisionOutcome | str) -> IntentState:
    raw = outcome.value if isinstance(outcome, DecisionOutcome) else str(outcome)
    return IntentState(raw)


def apply_transition(
    intent: Intent,
    target: IntentState,
    *,
    via: str,
    from_pending: bool = False,
) -> Transition:
    """Validate and (when appropriate) persist status on the Intent ORM object.

    - from_pending=True treats current status as PENDING (first gate write).
    - target=VERIFIED validates against ALLOW/CLEARED but does not overwrite status.
    """
    source = IntentState.PENDING if from_pending else outcome_to_state(intent.status)

    if target is IntentState.VERIFIED:
        # Allow verify from ALLOW or CLEARED; treat already-verified (same status) as idempotent
        if source not in (IntentState.ALLOW, IntentState.CLEARED, IntentState.VERIFIED):
            raise InvalidTransition(
                f"Illegal intent transition {source.value} → VERIFIED via {via}"
            )
        if source is IntentState.VERIFIED:
            return Transition(source=source, target=target, via=via)
        return assert_transition(source, IntentState.VERIFIED, via=via)

    transition = assert_transition(source, target, via=via)
    persisted = _PERSISTED.get(target)
    if persisted is not None:
        intent.status = persisted
    return transition


def mark_payment_verified(intent: Intent, *, via: str = "checkout_verify") -> Transition:
    """Convenience for Checkout verify / webhook — logical VERIFIED, status unchanged."""
    return apply_transition(intent, IntentState.VERIFIED, via=via)


def fsm_diagram() -> dict:
    """Machine-readable FSM for architecture endpoint / interviews."""
    return {
        "states": [s.value for s in IntentState],
        "transitions": [
            {"from": src.value, "to": dst.value}
            for src, targets in _TRANSITIONS.items()
            for dst in sorted(targets, key=lambda x: x.value)
        ],
        "persisted_outcomes": [o.value for o in DecisionOutcome],
        "notes": (
            "VERIFIED is logical (Checkout/webhook). Public API status stays ALLOW or CLEARED "
            "with decision reason_code=PAYMENT_VERIFIED."
        ),
    }


def all_transitions() -> Iterable[tuple[str, str]]:
    for src, targets in _TRANSITIONS.items():
        for dst in targets:
            yield src.value, dst.value
