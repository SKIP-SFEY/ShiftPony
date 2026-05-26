from pathlib import Path
import sys
import hashlib, json

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from flask import Flask, jsonify, render_template

from supporting_service.config import settings
from supporting_service.db import close_db, execute_sql_file, init_db
from supporting_service.routers.analytics import analytics_bp
from supporting_service.routers.gateway import gateway_bp
from supporting_service.routers.notifications import notifications_bp
from supporting_service.routers.reports import reports_bp


BASE_DIR = Path(__file__).resolve().parent
SUPPORTING_SCHEMA_FILE = BASE_DIR / "sql" / "schema.sql"


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["JSON_AS_ASCII"] = False

    init_db()
    execute_sql_file(SUPPORTING_SCHEMA_FILE)

    app.register_blueprint(gateway_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(notifications_bp)

    @app.get("/")
    def index():
        return render_template("supporting.html")

    @app.get("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "service": "supporting",
            }
        )

    @app.get("/api/about")
    def about():
        about_path = BASE_DIR / "about.json"

        with about_path.open("r", encoding="utf-8") as file:
            return jsonify(json.load(file))

    @app.get("/api/hash/<value>")
    def hash_value(value: str):
        return jsonify(
            {
                "request": value,
                "result": hashlib.sha256(value.encode("utf-8")).hexdigest(),
            }
        )

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        pass

    return app


app = create_app()


if __name__ == "__main__":
    try:
        app.run(
            host=settings.SUPPORTING_SERVICE_HOST,
            port=settings.SUPPORTING_SERVICE_PORT,
            debug=True,
        )
    finally:
        close_db()
