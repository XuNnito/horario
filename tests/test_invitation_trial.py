import sqlite3
import tempfile
import unittest
import os
from pathlib import Path

import app as app_module


class InvitationTrialTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.db"

        def connect():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn

        self.original_connect = app_module.get_db_connection
        self.original_admin_token = os.environ.get("ADMIN_TOKEN")
        os.environ["ADMIN_TOKEN"] = "test-admin"
        app_module.get_db_connection = connect
        app_module.init_db()
        app_module.app.config.update(TESTING=True, SECRET_KEY="test-secret")
        self.client = app_module.app.test_client()
        app_module._upsert_user("Prueba", "prueba@example.com")
        with self.client.session_transaction() as flask_session:
            flask_session["email"] = "prueba@example.com"
            flask_session["name"] = "Prueba"

    def tearDown(self):
        app_module.get_db_connection = self.original_connect
        if self.original_admin_token is None:
            os.environ.pop("ADMIN_TOKEN", None)
        else:
            os.environ["ADMIN_TOKEN"] = self.original_admin_token
        self.temp_dir.cleanup()

    def test_redeem_is_unlimited_for_24_hours_and_cannot_be_reused(self):
        response = self.client.post("/api/invitation/redeem", json={"code": "xunito"})
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["plan_id"], "invite_24h")
        self.assertEqual(payload["expires_at_ts"] - payload["now_ts"], 24 * 60 * 60)

        usage = self.client.post("/api/usage/print", json={"email": "prueba@example.com"})
        self.assertEqual(usage.status_code, 200)
        self.assertIsNone(usage.get_json()["active_limit"])

        repeated = self.client.post("/api/invitation/redeem", json={"code": "xunito"})
        self.assertEqual(repeated.status_code, 409)

    def test_expired_invitation_returns_expired_message(self):
        self.client.post("/api/invitation/redeem", json={"code": "xunito"})
        conn = app_module.get_db_connection()
        conn.execute("UPDATE users SET plan_expires_at = ? WHERE email = ?", (str(app_module._now_ts() - 1), "prueba@example.com"))
        conn.commit()
        conn.close()

        response = self.client.post("/api/invitation/redeem", json={"code": "xunito"})
        self.assertEqual(response.status_code, 409)
        self.assertIn("venció", response.get_json()["message"])

    def test_admin_can_cancel_and_reactivate_invitation(self):
        self.client.post("/api/invitation/redeem", json={"code": "xunito"})
        with self.client.session_transaction() as flask_session:
            flask_session["admin_authenticated"] = True
            flask_session["admin_csrf"] = "csrf-test"

        cancelled = self.client.post("/invitaciones/estado", data={
            "csrf_token": "csrf-test", "email": "prueba@example.com", "action": "cancel"
        })
        self.assertEqual(cancelled.status_code, 302)
        row = app_module._get_user("prueba@example.com")
        self.assertEqual(row["plan"], "free")
        self.assertEqual(row["invitation_status"], "cancelled")

        activated = self.client.post("/invitaciones/estado", data={
            "csrf_token": "csrf-test", "email": "prueba@example.com", "action": "activate"
        })
        self.assertEqual(activated.status_code, 302)
        row = app_module._get_user("prueba@example.com")
        self.assertEqual(row["plan"], "invite_24h")
        self.assertEqual(row["invitation_status"], "active")

    def test_free_plan_cannot_use_pro_actions(self):
        for endpoint in ("catalog-create", "print", "download"):
            response = self.client.post(
                f"/api/usage/{endpoint}",
                json={"email": "prueba@example.com"},
            )
            self.assertEqual(response.status_code, 403)
            payload = response.get_json()
            self.assertFalse(payload["allowed"])
            self.assertEqual(payload["active_limit"], 0)
            self.assertEqual(payload["current_value"], 0)

    def test_paid_plan_can_use_pro_actions(self):
        conn = app_module.get_db_connection()
        conn.execute(
            "UPDATE users SET plan = 'Plan_xunu', plan_expires_at = NULL WHERE email = ?",
            ("prueba@example.com",),
        )
        conn.commit()
        conn.close()

        response = self.client.post(
            "/api/usage/catalog-create",
            json={"email": "prueba@example.com"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["allowed"])
        self.assertEqual(payload["active_limit"], 10)
        self.assertEqual(payload["current_value"], 1)


if __name__ == "__main__":
    unittest.main()
