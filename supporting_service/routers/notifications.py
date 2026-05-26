from flask import Blueprint, jsonify, request

from supporting_service.db import fetch_all, fetch_one, fetch_value


notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


def _default_user_id() -> int | None:
    return fetch_value("SELECT id FROM users ORDER BY id LIMIT 1")


@notifications_bp.get("")
def list_notifications():
    requested_user_id = request.args.get("user_id", type=int)
    unread_only = request.args.get("unread_only", "false").lower() == "true"

    rows = fetch_all(
        """
        SELECT
            n.id,
            n.user_id AS "userId",
            u.login AS "userLogin",
            n.title,
            n.message,
            n.type,
            n.is_read AS "isRead",
            n.created_at::text AS "createdAt"
        FROM notifications n
        LEFT JOIN users u ON u.id = n.user_id
        WHERE (%s IS NULL OR n.user_id = %s)
          AND (%s = false OR n.is_read = false)
        ORDER BY n.created_at DESC, n.id DESC
        """,
        (requested_user_id, requested_user_id, unread_only),
    )

    return jsonify(
        {
            "authorization": "disabled",
            "count": len(rows),
            "items": rows,
        }
    )


@notifications_bp.post("")
def create_notification():
    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    message = str(data.get("message", "")).strip()
    notification_type = str(data.get("type", "info")).strip() or "info"
    target_user_id = data.get("user_id") or _default_user_id()

    if not title or not message:
        return jsonify({"detail": "title and message are required"}), 400

    try:
        target_user_id = int(target_user_id)
    except (TypeError, ValueError):
        return jsonify({"detail": "user_id must be an integer"}), 400

    row = fetch_one(
        """
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (%s, %s, %s, %s)
        RETURNING
            id,
            user_id AS "userId",
            title,
            message,
            type,
            is_read AS "isRead",
            created_at::text AS "createdAt"
        """,
        (target_user_id, title, message, notification_type),
    )

    return jsonify(row), 201


@notifications_bp.patch("/<int:notification_id>/read")
def mark_as_read(notification_id: int):
    row = fetch_one(
        """
        UPDATE notifications
        SET is_read = true
        WHERE id = %s
        RETURNING
            id,
            user_id AS "userId",
            title,
            message,
            type,
            is_read AS "isRead",
            created_at::text AS "createdAt"
        """,
        (notification_id,),
    )

    if not row:
        return jsonify({"detail": "Notification not found"}), 404

    return jsonify(row)
