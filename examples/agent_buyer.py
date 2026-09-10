#!/usr/bin/env python3
"""Minimal AI buyer agent demo against Sentinel-AP.

Usage:
  export SENTINEL_API_URL=https://sentinel-api-ecw9.onrender.com
  export SENTINEL_API_KEY=sap_demo000000000000000000000000000001
  python examples/agent_buyer.py
"""
from __future__ import annotations

import json
import os
import sys
import uuid
import urllib.error
import urllib.request

API_URL = os.environ.get("SENTINEL_API_URL", "https://sentinel-api-ecw9.onrender.com").rstrip("/")
API_KEY = os.environ.get("SENTINEL_API_KEY", "sap_demo000000000000000000000000000001")


def post_intent(body: dict, *, idempotency_key: str | None = None) -> dict:
    data = json.dumps(body).encode()
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-Request-Id": str(uuid.uuid4()),
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    req = urllib.request.Request(
        f"{API_URL}/api/v1/agent/intents",
        data=data,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            request_id = resp.headers.get("X-Request-Id")
            payload = json.loads(resp.read().decode())
            payload["_request_id"] = request_id
            return payload
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"HTTP {e.code}: {err}", file=sys.stderr)
        raise


def print_gates(result: dict) -> None:
    print(f"\n=== Intent {result.get('id')} → {result.get('status')} ===")
    print(f"message: {result.get('message')}")
    print(f"request_id: {result.get('_request_id')}")
    if result.get("razorpay_order_id"):
        print(f"razorpay_order_id: {result['razorpay_order_id']}")
    for d in result.get("decisions") or []:
        print(
            f"  [{d.get('gate')}] {d.get('outcome')} "
            f"{d.get('reason_code') or ''} — {d.get('reason_message') or ''}"
        )


def main() -> None:
    print(f"API: {API_URL}")
    scenarios = [
        {
            "name": "ALLOW — whitelist under budget",
            "body": {
                "amount_paise": 1999_00,
                "currency": "INR",
                "sku": "MOUSE-MX",
                "description": "agent_buyer allow demo",
            },
            "idem": f"demo-allow-{uuid.uuid4().hex[:8]}",
        },
        {
            "name": "HARD_BLOCK — blacklisted SKU",
            "body": {
                "amount_paise": 500_00,
                "currency": "INR",
                "sku": "WEAPON",
                "description": "should hard block",
            },
            "idem": None,
        },
        {
            "name": "HARD_BLOCK — amount cap",
            "body": {
                "amount_paise": 25000_00,
                "currency": "INR",
                "sku": "MONITOR-4K",
                "description": "over txn cap",
            },
            "idem": None,
        },
    ]

    for s in scenarios:
        print(f"\n--- {s['name']} ---")
        res = post_intent(s["body"], idempotency_key=s.get("idem"))
        print_gates(res)
        if s.get("idem"):
            print("(replaying same Idempotency-Key…)")
            again = post_intent(s["body"], idempotency_key=s["idem"])
            print_gates(again)
            assert again["id"] == res["id"], "idempotency failed — different intent ids"
            print("✓ idempotency returned same intent id")

    # Metrics snapshot
    with urllib.request.urlopen(f"{API_URL}/api/v1/public/metrics", timeout=20) as resp:
        metrics = json.loads(resp.read().decode())
    print("\n=== Public metrics ===")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
