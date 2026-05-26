from flask import Blueprint, jsonify

from supporting_service.config import settings


gateway_bp = Blueprint("gateway", __name__, url_prefix="/api/gateway")


@gateway_bp.get("/routes")
def routes():
    return jsonify(
        {
            "service": "supporting",
            "coreServiceUrl": settings.CORE_SERVICE_URL,
            "format": "json",
            "routes": [
                {"method": "GET", "path": "/health", "group": "system"},
                {"method": "GET", "path": "/api/reports/summary", "group": "reports"},
                {"method": "GET", "path": "/api/reports/shifts", "group": "reports"},
                {"method": "GET", "path": "/api/reports/employees", "group": "reports"},
                {"method": "GET", "path": "/api/analytics/overview", "group": "analytics"},
                {"method": "GET", "path": "/api/notifications", "group": "notifications"},
                {"method": "POST", "path": "/api/notifications", "group": "notifications"},
                {"method": "PATCH", "path": "/api/notifications/<id>/read", "group": "notifications"},
                {"method": "GET", "path": "/api/about", "group": "system"},
                {"method": "GET", "path": "/api/hash/<str>", "group": "system"},
            ],
        }
    )
