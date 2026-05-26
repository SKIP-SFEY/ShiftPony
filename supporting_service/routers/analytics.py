from flask import Blueprint, jsonify

from supporting_service.db import fetch_all, fetch_value


analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


@analytics_bp.get("/overview")
def overview():
    shifts_by_status = fetch_all(
        """
        SELECT status, count(*) AS count
        FROM shifts
        GROUP BY status
        ORDER BY count DESC, status
        """
    )

    equipment_by_status = fetch_all(
        """
        SELECT status, count(*) AS count
        FROM equipment
        GROUP BY status
        ORDER BY count DESC, status
        """
    )

    employee_workload = fetch_all(
        """
        SELECT
            e.id,
            e.name,
            count(s.id) AS "shiftsCount"
        FROM employees e
        LEFT JOIN shifts s ON s.employee_id = e.id
        GROUP BY e.id, e.name
        ORDER BY "shiftsCount" DESC, e.name
        """
    )

    return jsonify(
        {
            "employeesCount": fetch_value("SELECT count(*) FROM employees"),
            "equipmentCount": fetch_value("SELECT count(*) FROM equipment"),
            "shiftsCount": fetch_value("SELECT count(*) FROM shifts"),
            "shiftsByStatus": shifts_by_status,
            "equipmentByStatus": equipment_by_status,
            "employeeWorkload": employee_workload,
        }
    )
