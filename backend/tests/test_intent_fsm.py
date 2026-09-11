"""Unit tests for Intent FSM transitions."""
from types import SimpleNamespace

import pytest

from app.models.entities import DecisionOutcome
from app.services.intent_fsm import (
    IntentState,
    InvalidTransition,
    apply_transition,
    assert_transition,
    can_transition,
    fsm_diagram,
    mark_payment_verified,
)


def test_pending_to_hard_block_allow_queued_failed():
    for target in (IntentState.HARD_BLOCK, IntentState.QUEUED, IntentState.ALLOW, IntentState.FAILED):
        assert can_transition(IntentState.PENDING, target)


def test_hard_block_is_terminal():
    assert not can_transition(IntentState.HARD_BLOCK, IntentState.ALLOW)
    assert not can_transition(IntentState.FAILED, IntentState.QUEUED)


def test_queued_to_cleared():
    assert can_transition(IntentState.QUEUED, IntentState.CLEARED)
    assert can_transition(IntentState.QUEUED, IntentState.FAILED)
    assert can_transition(IntentState.QUEUED, IntentState.QUEUED)


def test_illegal_hard_block_to_allow_raises():
    with pytest.raises(InvalidTransition):
        assert_transition(IntentState.HARD_BLOCK, IntentState.ALLOW, via="illegal")


def test_apply_from_pending_persists():
    intent = SimpleNamespace(status=DecisionOutcome.ALLOW)
    apply_transition(intent, IntentState.HARD_BLOCK, via="gate1_fail", from_pending=True)
    assert intent.status == DecisionOutcome.HARD_BLOCK


def test_verified_keeps_allow_status():
    intent = SimpleNamespace(status=DecisionOutcome.ALLOW)
    mark_payment_verified(intent, via="checkout_verify")
    assert intent.status == DecisionOutcome.ALLOW


def test_verified_from_queued_illegal():
    intent = SimpleNamespace(status=DecisionOutcome.QUEUED)
    with pytest.raises(InvalidTransition):
        mark_payment_verified(intent)


def test_fsm_diagram_shape():
    d = fsm_diagram()
    assert "PENDING" in d["states"]
    assert "VERIFIED" in d["states"]
    assert any(t["from"] == "PENDING" and t["to"] == "HARD_BLOCK" for t in d["transitions"])
