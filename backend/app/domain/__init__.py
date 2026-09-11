"""Domain layer — typed decisions and architecture metadata (no I/O)."""

from app.domain.decisions import (
    HealthDecision,
    PaymentDispatch,
    PipelineResult,
    PolicyDecision,
)
from app.domain.architecture import architecture_diagram

__all__ = [
    "HealthDecision",
    "PaymentDispatch",
    "PipelineResult",
    "PolicyDecision",
    "architecture_diagram",
]
