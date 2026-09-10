def test_routes_include_payments():
    from app.main import create_app
    app = create_app()
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/api/v1/public/config" in paths
    assert "/api/v1/payments/verify" in paths
    assert "/api/v1/admin/razorpay/status" in paths
    assert "/api/v1/agent/intents" in paths
