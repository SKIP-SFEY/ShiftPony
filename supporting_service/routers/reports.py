from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from supporting_service.db import fetch_all, fetch_value


reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def _period_params() -> tuple[str | None, str | None]:
    return request.args.get("date_from"), request.args.get("date_to")


@reports_bp.get("/summary")
def summary_report():
    date_from, date_to = _period_params()

    shifts_count = fetch_value(
        """
        SELECT count(*)
        FROM shifts
        WHERE (%s IS NULL OR shift_date >= %s::date)
          AND (%s IS NULL OR shift_date <= %s::date)
        """,
        (date_from, date_from, date_to, date_to),
    )

    planned_shifts = fetch_value(
        """
        SELECT count(*)
        FROM shifts
        WHERE status ILIKE '%%заплан%%'
          AND (%s IS NULL OR shift_date >= %s::date)
          AND (%s IS NULL OR shift_date <= %s::date)
        """,
        (date_from, date_from, date_to, date_to),
    )

    completed_shifts = fetch_value(
        """
        SELECT count(*)
        FROM shifts
        WHERE status ILIKE '%%выполн%%'
          AND (%s IS NULL OR shift_date >= %s::date)
          AND (%s IS NULL OR shift_date <= %s::date)
        """,
        (date_from, date_from, date_to, date_to),
    )

    return jsonify(
        {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "generatedBy": "open-supporting-service",
            "authorization": "disabled",
            "period": {
                "dateFrom": date_from,
                "dateTo": date_to,
            },
            "employeesCount": fetch_value("SELECT count(*) FROM employees"),
            "usersCount": fetch_value("SELECT count(*) FROM users"),
            "equipmentCount": fetch_value("SELECT count(*) FROM equipment"),
            "shiftsCount": shifts_count,
            "plannedShifts": planned_shifts,
            "completedShifts": completed_shifts,
        }
    )


@reports_bp.get("/shifts")
def shifts_report():
    date_from, date_to = _period_params()
    status = request.args.get("status")

    rows = fetch_all(
        """
        SELECT
            s.id,
            s.shift_date::text AS "date",
            s.time,
            s.status,
            e.id AS "employeeId",
            e.name AS "employeeName",
            eq.id AS "equipmentId",
            eq.name AS "equipmentName"
        FROM shifts s
        JOIN employees e ON e.id = s.employee_id
        LEFT JOIN equipment eq ON eq.id = s.equipment_id
        WHERE (%s IS NULL OR s.shift_date >= %s::date)
          AND (%s IS NULL OR s.shift_date <= %s::date)
          AND (%s IS NULL OR s.status = %s)
        ORDER BY s.shift_date, s.time, s.id
        """,
        (date_from, date_from, date_to, date_to, status, status),
    )

    return jsonify(
        {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "generatedBy": "open-supporting-service",
            "authorization": "disabled",
            "count": len(rows),
            "items": rows,
        }
    )


@reports_bp.get("/employees")
def employees_report():
    rows = fetch_all(
        """
        SELECT
            e.id,
            e.name,
            e.phone,
            e.email,
            e.skills,
            u.login,
            u.role,
            count(s.id) AS "shiftsCount"
        FROM employees e
        LEFT JOIN users u ON u.employee_id = e.id
        LEFT JOIN shifts s ON s.employee_id = e.id
        GROUP BY e.id, u.login, u.role
        ORDER BY e.id
        """
    )

    return jsonify(
        {
            "authorization": "disabled",
            "count": len(rows),
            "items": rows,
        }
    )
