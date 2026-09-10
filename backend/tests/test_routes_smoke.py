def test_routes_include_payments():
    from app.main import create_app, APP_VERSION

    app = create_app()
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/api/v1/public/config" in paths
    assert "/api/v1/payments/verify" in paths
    assert "/api/v1/admin/razorpay/status" in paths
    assert "/api/v1/agent/intents" in paths
    assert "/api/v1/webhooks/razorpay" in paths
    assert "/api/v1/public/metrics" in paths
    assert "/api/v1/metrics" in paths
    assert APP_VERSION == "1.2.0"
    assert app.version == "1.2.0"


def test_request_id_middleware_registered():
    from app.main import create_app
    from app.middleware.request_id import RequestIdMiddleware

    app = create_app()
    assert any(isinstance(m.cls, type) and m.cls is RequestIdMiddleware for m in app.user_middleware) or any(
        getattr(m, "cls", None) is RequestIdMiddleware for m in app.user_middleware
    )
