"""Smoke tests for architecture diagram + version bump."""
from app.domain.architecture import architecture_diagram
from app.main import APP_VERSION, create_app


def test_app_version():
    assert APP_VERSION == "1.4.0"
    app = create_app()
    assert app.version == APP_VERSION


def test_architecture_diagram_has_planes_and_fsm():
    d = architecture_diagram(version=APP_VERSION)
    assert d["version"] == APP_VERSION
    plane_ids = {p["id"] for p in d["planes"]}
    assert plane_ids == {"ingress", "control", "execution", "reliability", "observability"}
    assert "intent_fsm" in d
    assert "HARD_BLOCK" in d["intent_fsm"]["states"]


def test_routes_include_architecture_and_drain():
    app = create_app()
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/api/v1/public/architecture" in paths
    assert "/api/v1/admin/system" in paths
    assert "/api/v1/admin/queue/drain" in paths
    assert "/api/v1/public/config" in paths
    assert "/api/v1/payments/verify" in paths
