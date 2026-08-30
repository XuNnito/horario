from __future__ import annotations

import os
import sqlite3
import json
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from flask import (
		Flask,
		abort,
		jsonify,
		redirect,
		render_template_string,
		request,
		session,
)
from urllib.parse import urlsplit, urlencode

try:
		# Cargar variables de entorno desde .env en desarrollo/local
		from dotenv import load_dotenv  # type: ignore[import]

		load_dotenv()
except Exception:
		# En producción (Heroku, etc.) normalmente ya vienen en el entorno
		pass


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.path.join(BASE_DIR, "security_logs.db")
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")

# Configuración OAuth de Google para Drive (lado servidor)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
# El redirect_uri se calcula dinámicamente según el host actual.

# Configuración de Stripe (claves y planes)
STRIPE_SECRET_KEY = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
STRIPE_PUBLISHABLE_KEY = (os.environ.get("STRIPE_PUBLISHABLE_KEY") or "").strip()
STRIPE_WEBHOOK_SECRET = (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip()

# Código que concede acceso completo temporal. En producción se recomienda
# definir INVITATION_CODE en Vercel; se conserva "xunito" por compatibilidad.
INVITATION_CODE = (os.environ.get("INVITATION_CODE") or "xunito").strip()
INVITATION_PLAN_ID = "invite_24h"
LEGACY_INVITATION_PLAN_ID = f"invite_{3 * 24}h"
INVITATION_DURATION_SECONDS = 24 * 60 * 60

# Planes disponibles en la app (ids lógicos internos)
# En este proyecto usamos un único plan de pago basado en usos:
#   Plan_xunu -> 49.99 MXN, sin fecha de expiración (se limita por número de usos).
PLAN_DURATIONS_DAYS = {
		"Plan_xunu": None,
}

# Ids de precios de Stripe (rellenar con tu price_xxx real)
# "Plan_xunu" será el plan de 49.99 MXN, sin renovación automática.
STRIPE_PRICE_IDS = {
		"Plan_xunu": os.environ.get("STRIPE_PRICE_Plan_xunu"),
}


try:
		import stripe  # type: ignore[import]

		if STRIPE_SECRET_KEY:
				stripe.api_key = STRIPE_SECRET_KEY
except ImportError:  # Stripe no instalado aún
		stripe = None  # type: ignore[assignment]


def _has_valid_stripe_secret_key() -> bool:
		return bool(STRIPE_SECRET_KEY and STRIPE_SECRET_KEY.startswith(("sk_test_", "sk_live_")))


class PostgresCursor:
		"""Compatibility layer for the existing SQLite-style queries."""

		def __init__(self, cursor: Any) -> None:
				self._cursor = cursor

		def execute(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> Any:
				return self._cursor.execute(query.replace("?", "%s"), params or ())

		def fetchone(self) -> Any:
				return self._cursor.fetchone()

		def fetchall(self) -> Any:
				return self._cursor.fetchall()


class PostgresConnection:
		def __init__(self, connection: Any) -> None:
				self._connection = connection

		def cursor(self) -> PostgresCursor:
				return PostgresCursor(self._connection.cursor())

		def commit(self) -> None:
				self._connection.commit()

		def close(self) -> None:
				self._connection.close()


def get_db_connection() -> Any:
		if DATABASE_URL:
				try:
						import psycopg
						from psycopg.rows import dict_row
				except ImportError as exc:
						raise RuntimeError("DATABASE_URL requiere instalar psycopg") from exc
				url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
				return PostgresConnection(psycopg.connect(url, row_factory=dict_row))

		conn = sqlite3.connect(DB_PATH)
		conn.row_factory = sqlite3.Row
		return conn


def init_db() -> None:
		conn = get_db_connection()
		cur = conn.cursor()
		is_postgres = bool(DATABASE_URL)
		visit_id = "BIGSERIAL PRIMARY KEY" if is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"

		# Tabla de visitas (tanto anónimas como con sesión)
		cur.execute(
				f"""
				CREATE TABLE IF NOT EXISTS visits (
						id {visit_id},
						ts TEXT NOT NULL,
						ip TEXT,
						user_agent TEXT,
						path TEXT,
						event_type TEXT,
						name TEXT,
						email TEXT
				)
				"""
		)

		# Tabla de usuarios identificados (por correo)
		cur.execute(
				"""
				CREATE TABLE IF NOT EXISTS users (
						email TEXT PRIMARY KEY,
						name TEXT,
						first_seen TEXT NOT NULL,
						last_seen TEXT NOT NULL,
						status TEXT NOT NULL DEFAULT 'active' -- active | suspended | deleted
				)
				"""
		)

		# Columnas adicionales para planes de pago
		try:
				clause = "IF NOT EXISTS " if is_postgres else ""
				cur.execute(f"ALTER TABLE users ADD COLUMN {clause}plan TEXT NOT NULL DEFAULT 'free'")
		except sqlite3.OperationalError:
				# Ya existe la columna
				pass

		try:
				clause = "IF NOT EXISTS " if is_postgres else ""
				cur.execute(f"ALTER TABLE users ADD COLUMN {clause}plan_expires_at TEXT")  # epoch en segundos o NULL
		except sqlite3.OperationalError:
				# Ya existe la columna
				pass

		# Auditoría independiente del acceso temporal. Permite saber quién usó el
		# código aun después de que venza o un administrador lo cancele.
		try:
				clause = "IF NOT EXISTS " if is_postgres else ""
				cur.execute(f"ALTER TABLE users ADD COLUMN {clause}invitation_redeemed_at TEXT")
		except sqlite3.OperationalError:
				pass

		try:
				clause = "IF NOT EXISTS " if is_postgres else ""
				cur.execute(f"ALTER TABLE users ADD COLUMN {clause}invitation_status TEXT")
		except sqlite3.OperationalError:
				pass

		# Migra el identificador anterior y limita también las invitaciones que ya
		# existían a 24 horas desde su fecha original de canje.
		cur.execute(
				"SELECT email, plan_expires_at, invitation_redeemed_at FROM users WHERE plan = ?",
				(LEGACY_INVITATION_PLAN_ID,),
		)
		for legacy_invite in cur.fetchall():
				legacy_expiry = legacy_invite["plan_expires_at"]
				try:
						redeemed_iso = str(legacy_invite["invitation_redeemed_at"] or "").replace("Z", "+00:00")
						twenty_four_hour_expiry = int(datetime.fromisoformat(redeemed_iso).timestamp()) + INVITATION_DURATION_SECONDS
						legacy_expiry = str(min(int(legacy_expiry), twenty_four_hour_expiry))
				except (TypeError, ValueError):
						pass
				cur.execute(
						"UPDATE users SET plan = ?, plan_expires_at = ? WHERE email = ?",
						(INVITATION_PLAN_ID, legacy_expiry, legacy_invite["email"]),
				)

		# Columnas para contar usos (límites del plan gratuito)
		try:
				clause = "IF NOT EXISTS " if is_postgres else ""
				cur.execute(f"ALTER TABLE users ADD COLUMN {clause}catalog_created_count INTEGER NOT NULL DEFAULT 0")
		except sqlite3.OperationalError:
				pass

		try:
				clause = "IF NOT EXISTS " if is_postgres else ""
				cur.execute(f"ALTER TABLE users ADD COLUMN {clause}print_count INTEGER NOT NULL DEFAULT 0")
		except sqlite3.OperationalError:
				pass

		try:
				clause = "IF NOT EXISTS " if is_postgres else ""
				cur.execute(f"ALTER TABLE users ADD COLUMN {clause}download_count INTEGER NOT NULL DEFAULT 0")
		except sqlite3.OperationalError:
				pass

		# Tabla para vincular correos con clientes de Stripe (para recordar métodos de pago)
		try:
				cur.execute(
						"""
						CREATE TABLE IF NOT EXISTS stripe_customers (
								email TEXT PRIMARY KEY,
								customer_id TEXT NOT NULL
						)
						""",
				)
		except sqlite3.OperationalError:
				pass

		# Tabla para guardar tokens de Google OAuth (Drive) por correo
		try:
				cur.execute(
						"""
						CREATE TABLE IF NOT EXISTS google_tokens (
								email TEXT PRIMARY KEY,
								refresh_token TEXT NOT NULL,
								access_token TEXT,
								access_token_expires_at INTEGER
						)
						""",
				)
		except sqlite3.OperationalError:
				pass

		# Columna opcional para guardar la URL del avatar/foto de perfil
		try:
				clause = "IF NOT EXISTS " if is_postgres else ""
				cur.execute(f"ALTER TABLE users ADD COLUMN {clause}avatar_url TEXT")
		except sqlite3.OperationalError:
				# Ya existe la columna
				pass

		try:
				clause = "IF NOT EXISTS " if is_postgres else ""
				cur.execute(f"ALTER TABLE users ADD COLUMN {clause}last_payment_event_id TEXT")
		except sqlite3.OperationalError:
				pass

		# Tabla para guardar un snapshot del horario por usuario
		try:
				cur.execute(
						"""
						CREATE TABLE IF NOT EXISTS schedules (
								email TEXT PRIMARY KEY,
								data TEXT NOT NULL,
								updated_at TEXT NOT NULL
						)
						""",
				)
		except sqlite3.OperationalError:
				pass

		conn.commit()
		conn.close()


app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")

# Clave de sesión para firmar cookies seguras.
# En producción, define FLASK_SECRET_KEY con un valor largo y aleatorio.
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or os.environ.get("SESSION_SECRET") or "dev-change-me"

# Duración máxima de la sesión de la app: ~4 meses (120 días).
app.permanent_session_lifetime = timedelta(days=120)

# Opcional: permitir que la cookie de sesión funcione cuando el frontend
# está en otro dominio (por ejemplo, GitHub Pages) y hace peticiones
# al backend con credentials="include".
#
# En Vercel el frontend vive en GitHub Pages y la cookie necesariamente viaja
# entre sitios. Vercel siempre sirve HTTPS, así que activamos automáticamente
# SameSite=None allí; fuera de Vercel se conserva el override explícito.
cross_site_session_enabled = (
		os.environ.get("SESSION_SAMESITE_NONE", "0") == "1"
		or bool(os.environ.get("VERCEL"))
)
if cross_site_session_enabled:
		app.config.update(
				SESSION_COOKIE_SAMESITE="None",
				SESSION_COOKIE_SECURE=True,
				SESSION_COOKIE_HTTPONLY=True,
		)

# Flask 3 ya no tiene before_first_request; inicializamos la BD al importar el módulo.
init_db()


@app.after_request
def add_cors_headers(response):  # type: ignore[override]
		"""Permite que el frontend se conecte desde otro dominio.

		Se usa la variable de entorno FRONTEND_ORIGIN para configurar
		los orígenes permitidos. Puedes definir uno o varios separados
		por comas, por ejemplo:

		FRONTEND_ORIGIN="https://xunnito.github.io,http://127.0.0.1:5501"
		"""

		origin = request.headers.get("Origin")
		configured = os.environ.get("FRONTEND_ORIGIN", "")

		allowed_origins: list[str] = []
		if configured:
				# Soporta varios orígenes separados por comas y normaliza quitando el path.
				raw_list = [o.strip().rstrip("/") for o in configured.split(",") if o.strip()]
				for item in raw_list:
						allowed_origins.append(item)
						try:
								parsed = urlsplit(item)
								if parsed.scheme and parsed.netloc:
										base = f"{parsed.scheme}://{parsed.netloc}"
										if base not in allowed_origins:
												allowed_origins.append(base)
						except Exception:  # noqa: BLE001
								pass
		else:
				
				allowed_origins = [
						"https://xunnito.github.io",
						"http://127.0.0.1:5500",
						"http://localhost:5500",
						"http://127.0.0.1:5500",
				]

		if origin:
				origin_clean = origin.rstrip("/")
				if origin_clean in allowed_origins:
						response.headers["Access-Control-Allow-Origin"] = origin
						response.headers["Vary"] = "Origin"
						response.headers["Access-Control-Allow-Credentials"] = "true"

		response.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
		response.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		# Aseguramos que las preflight OPTIONS respondan 200 con los headers
		if request.method == "OPTIONS" and response.status_code == 405:
				response.status_code = 200
		return response


def _now_iso() -> str:
		return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _now_ts() -> int:
		"""Devuelve timestamp UTC en segundos (entero)."""
		return int(datetime.now(timezone.utc).timestamp())


def _format_ts_for_display(raw: str | None) -> str:
		"""Convierte un ISO UTC ("2025-01-20T12:34:56Z") a fecha/hora legible.

		Se aplica un desfase horario configurable vía LOCAL_UTC_OFFSET_HOURS
		(en horas, por defecto -6 para México centro aproximado).
		"""

		if not raw:
				return "-"
		try:
				# Acepta tanto "Z" como "+00:00"
				iso = raw.replace("Z", "+00:00")
				dt_utc = datetime.fromisoformat(iso)
		except Exception:  # noqa: BLE001
				return raw

		try:
				offset_hours = int(os.environ.get("LOCAL_UTC_OFFSET_HOURS", "-6"))
		except ValueError:
				offset_hours = -6

		dt_local = dt_utc + timedelta(hours=offset_hours)
		return dt_local.strftime("%d/%m/%Y %H:%M")


def _format_epoch_for_display(raw: int | str | None) -> str:
		if raw is None:
				return "-"
		try:
				dt_utc = datetime.fromtimestamp(int(raw), timezone.utc)
				offset_hours = int(os.environ.get("LOCAL_UTC_OFFSET_HOURS", "-6"))
		except (TypeError, ValueError, OSError):
				return "-"
		return (dt_utc + timedelta(hours=offset_hours)).strftime("%d/%m/%Y %H:%M")


def _get_ip() -> str | None:
		# Respeta cabecera X-Forwarded-For si estás detrás de un proxy/reverso
		fwd = request.headers.get("X-Forwarded-For")
		if fwd:
				return fwd.split(",")[0].strip()
		return request.remote_addr


def _upsert_user(name: str | None, email: str | None, avatar_url: str | None = None) -> None:
		if not email:
				return
		conn = get_db_connection()
		cur = conn.cursor()
		now = _now_iso()

		cur.execute("SELECT email, avatar_url FROM users WHERE email = ?", (email,))
		row = cur.fetchone()
		if row:
				# Mantener el avatar anterior si no se proporciona uno nuevo
				if avatar_url is not None and avatar_url != "":
						cur.execute(
								"UPDATE users SET name = COALESCE(?, name), avatar_url = ?, last_seen = ? WHERE email = ?",
								(name, avatar_url, now, email),
						)
				else:
						cur.execute(
								"UPDATE users SET name = COALESCE(?, name), last_seen = ? WHERE email = ?",
								(name, now, email),
						)
		else:
				cur.execute(
						"INSERT INTO users (email, name, avatar_url, first_seen, last_seen, status) VALUES (?, ?, ?, ?, ?, 'active')",
						(email, name, avatar_url, now, now),
				)

		conn.commit()
		conn.close()


def _get_user(email: str) -> sqlite3.Row | None:
		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute(
				"""
				SELECT
					email,
					name,
					avatar_url,
					first_seen,
					last_seen,
					status,
					plan,
					plan_expires_at,
					invitation_redeemed_at,
					invitation_status,
					catalog_created_count,
					print_count,
					download_count
				FROM users
				WHERE email = ?
				""",
				(email,),
		)
		row = cur.fetchone()
		conn.close()
		return row


def _insert_visit(event_type: str, name: str | None, email: str | None, path: str | None) -> None:
		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute(
				"""
				INSERT INTO visits (ts, ip, user_agent, path, event_type, name, email)
				VALUES (?, ?, ?, ?, ?, ?, ?)
				""",
				(
						_now_iso(),
						_get_ip(),
						request.headers.get("User-Agent"),
						path or request.path,
						event_type,
						name,
						email,
				),
		)
		conn.commit()
		conn.close()


def _save_google_tokens(
		email: str,
		refresh_token: str,
		access_token: str | None,
		access_expires_at: int | None,
) -> None:
		"""Guarda o actualiza los tokens de Google para un usuario.

		- refresh_token: largo plazo (offline), obligatorio.
		- access_token: corto plazo, se puede regenerar usando el refresh_token.
		"""

		if not email or not refresh_token:
				return

		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute(
				"""
				INSERT INTO google_tokens (email, refresh_token, access_token, access_token_expires_at)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(email) DO UPDATE SET
					refresh_token = excluded.refresh_token,
					access_token = COALESCE(excluded.access_token, google_tokens.access_token),
					access_token_expires_at = COALESCE(excluded.access_token_expires_at, google_tokens.access_token_expires_at)
				""",
				(email, refresh_token, access_token, access_expires_at),
		)
		conn.commit()
		conn.close()


def _get_fresh_google_access_token(email: str) -> str | None:
		"""Devuelve un access_token válido para Google Drive usando el refresh_token guardado.

		Si el access_token actual no ha expirado, se reutiliza. Si ha expirado, se solicita
		uno nuevo a Google usando el refresh_token y se actualiza en la BD.
		"""

		if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
				return None
		if not email:
				return None

		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute(
				"SELECT refresh_token, access_token, access_token_expires_at FROM google_tokens WHERE email = ?",
				(email,),
		)
		row = cur.fetchone()
		if row is None:
				conn.close()
				return None

		refresh_token = row["refresh_token"]
		access_token = row["access_token"]
		expires_at = row["access_token_expires_at"] or 0
		now_ts = _now_ts()

		try:
				expires_at_int = int(expires_at)
		except (TypeError, ValueError):
				expires_at_int = 0

		# Si el access_token aún es válido (con pequeño margen), reutilizar
		if access_token and expires_at_int - 60 > now_ts:
				conn.close()
				return str(access_token)

		# Generar nuevo access_token usando el refresh_token
		try:
				resp = requests.post(
						"https://oauth2.googleapis.com/token",
						data={
								"client_id": GOOGLE_CLIENT_ID,
								"client_secret": GOOGLE_CLIENT_SECRET,
								"refresh_token": refresh_token,
								"grant_type": "refresh_token",
						},
						timeout=10,
				)
				data = resp.json()
				new_access = data.get("access_token")
				expires_in = data.get("expires_in")
				if not new_access or not expires_in:
						conn.close()
						return None

				new_expires_at = now_ts + int(expires_in)
				cur.execute(
						"UPDATE google_tokens SET access_token = ?, access_token_expires_at = ? WHERE email = ?",
						(str(new_access), int(new_expires_at), email),
				)
				conn.commit()
		finally:
				conn.close()

		return str(new_access)


def _get_or_create_stripe_customer(email: str, name: str | None = None) -> str | None:
	"""Obtiene o crea un Customer de Stripe para este correo.

	Se guarda en la tabla stripe_customers para reutilizarlo en futuros pagos
	y así permitir que Stripe recuerde métodos de pago.
	"""

	if stripe is None or not STRIPE_SECRET_KEY:
		return None
	if not email:
		return None

	conn = get_db_connection()
	cur = conn.cursor()
	cur.execute("SELECT customer_id FROM stripe_customers WHERE email = ?", (email,))
	row = cur.fetchone()
	if row is not None:
		conn.close()
		return str(row["customer_id"])  # type: ignore[index]

	# Crear un nuevo Customer en Stripe y guardarlo
	try:
		customer = stripe.Customer.create(  # type: ignore[call-arg]
				email=email,
				name=name or None,
		)
	except Exception:  # noqa: BLE001
		conn.close()
		return None

	customer_id = getattr(customer, "id", None)
	if not customer_id:
		conn.close()
		return None

	cur.execute(
			"""
			INSERT INTO stripe_customers (email, customer_id) VALUES (?, ?)
			ON CONFLICT(email) DO UPDATE SET customer_id = excluded.customer_id
			""",
			(email, str(customer_id)),
	)
	conn.commit()
	conn.close()
	return str(customer_id)


def _activate_plan_for_user(
		email: str | None,
		plan_id: str | None,
		name: str | None = None,
		payment_event_id: str | None = None,
) -> None:
		"""Activa un plan para un usuario concreto, calculando la expiración.

		Se usa desde el webhook de Stripe.
		"""

		if not email or not plan_id or plan_id not in PLAN_DURATIONS_DAYS:
				return

		# Asegura que el usuario exista en la tabla users
		_upsert_user(name, email)

		duration_days = PLAN_DURATIONS_DAYS[plan_id]
		if duration_days is None:
				expires_ts: str | None = None
		else:
				expires_ts = str(_now_ts() + duration_days * 24 * 60 * 60)

		conn = get_db_connection()
		cur = conn.cursor()
		if payment_event_id:
				cur.execute("SELECT last_payment_event_id FROM users WHERE email = ?", (email,))
				payment_row = cur.fetchone()
				if payment_row and payment_row["last_payment_event_id"] == payment_event_id:
						conn.close()
						return
		# Al activar un plan de pago, reiniciamos los contadores de uso para que
		# el usuario vuelva a tener el paquete completo de usos (no se acumulan).
		cur.execute(
				"""
				UPDATE users
				SET plan = ?,
						plan_expires_at = ?,
						catalog_created_count = 0,
						print_count = 0,
						download_count = 0,
						last_payment_event_id = ?
				WHERE email = ?
				""",
				(plan_id, expires_ts, payment_event_id, email),
		)
		conn.commit()
		conn.close()


def _calculate_effective_plan(row: sqlite3.Row | None) -> tuple[str, str, int | None]:
		"""Devuelve (plan_efectivo, plan_guardado, expires_ts).

		- plan_guardado: valor literal en BD (o 'free').
		- plan_efectivo: si está expirado se normaliza a 'free'.
		"""

		now_ts = _now_ts()
		if row is None:
				return "free", "free", None

		stored_plan = row["plan"] if "plan" in row.keys() else "free"  # type: ignore[operator]
		stored_plan = stored_plan or "free"
		expires_raw = row["plan_expires_at"] if "plan_expires_at" in row.keys() else None  # type: ignore[operator]

		expires_ts: int | None
		if expires_raw is None:
				expires_ts = None
		else:
				try:
						expires_ts = int(expires_raw)
						# Si por errores antiguos quedó como 0 o negativo,
						# lo tratamos como "sin expiración" para no degradar
						# injustamente planes de pago ya activados.
						if expires_ts <= 0:
								expires_ts = None
				except (TypeError, ValueError):
						expires_ts = None

		effective = stored_plan
		# Para el plan Plan_xunu el diseño actual es "sin fecha de expiración",
		# solo limitado por número de usos. Ignoramos cualquier fecha guardada.
		if effective == "Plan_xunu":
				expires_ts = None

		# Cualquier acceso temporal con fecha vencida vuelve a "free".
		if effective != "free" and expires_ts is not None and expires_ts < now_ts:
				effective = "free"

		return effective, stored_plan, expires_ts


@app.route("/")
def index():
		"""Sirve la página principal y registra una visita anónima."""
		#_insert_visit(event_type="page_view", name=None, email=None, path=request.path)
		# Envía el archivo index.html existente
		#reordar q se actuva
		return app.send_static_file("index.html")


@app.route("/xunito")
@app.route("/xunito/")
def xunito_index():
	"""Sirve la página especial de Xunito sin redirigir a index.html.

	Permite que /xunito y /xunito/ carguen el archivo xunito/index.html
	sin cambiar la URL en el navegador.
	"""

	return app.send_static_file("xunito/index.html")


@app.get("/auth/google")
def auth_google_start():
		"""Inicia el flujo OAuth de Google (lado servidor) para Drive.

		Redirige al usuario a la pantalla de consentimiento de Google. Una vez que
		acepta, Google redirige a /auth/google/callback con un código de autorización.
		"""

		if not GOOGLE_CLIENT_ID:
				return "Google OAuth no está configurado en el servidor (falta GOOGLE_CLIENT_ID)", 500

		# Determinar redirect_uri dinámicamente según el host actual
		base = request.url_root.rstrip("/")
		redirect_uri = f"{base}/auth/google/callback"

		scope = " ".join(
				[
						"https://www.googleapis.com/auth/drive.appdata",
						"https://www.googleapis.com/auth/userinfo.email",
						"openid",
				],
		)

		params = {
				"client_id": GOOGLE_CLIENT_ID,
				"redirect_uri": redirect_uri,
				"response_type": "code",
				"scope": scope,
				"access_type": "offline",
				"include_granted_scopes": "true",
				"prompt": "consent",
		}
		auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
		return redirect(auth_url)


@app.get("/auth/google/callback")
def auth_google_callback():
		"""Callback de Google OAuth: intercambia el code por tokens y los guarda.

		Después de guardar los tokens y crear la sesión de la app, redirige al
		inicio para que el frontend pueda seguir trabajando normalmente.
		"""

		if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
				return "Google OAuth no está configurado correctamente en el servidor.", 500

		code = request.args.get("code")
		if not code:
				return "Falta el parámetro 'code' en la respuesta de Google.", 400

		# Debe coincidir exactamente con el redirect_uri usado en auth_google_start
		base = request.url_root.rstrip("/")
		redirect_uri = f"{base}/auth/google/callback"

		# Intercambiar code por tokens en el endpoint de Google
		try:
				resp = requests.post(
						"https://oauth2.googleapis.com/token",
						data={
								"code": code,
								"client_id": GOOGLE_CLIENT_ID,
								"client_secret": GOOGLE_CLIENT_SECRET,
								"redirect_uri": redirect_uri,
								"grant_type": "authorization_code",
						},
						timeout=10,
				)
				data = resp.json()
		except Exception as exc:  # noqa: BLE001
				return f"Error al solicitar tokens a Google: {exc}", 500

		refresh_token = data.get("refresh_token")
		access_token = data.get("access_token")
		expires_in = data.get("expires_in")
		if not refresh_token:
				# Google solo envía refresh_token la primera vez que se concede acceso.
				# Si no hay refresh_token, no podremos renovar. Avisar.
				return "Google no devolvió refresh_token. Entra a tu configuración de aplicaciones conectadas y vuelve a autorizar la app.", 500

		# Obtener correo del usuario desde el endpoint userinfo
		try:
				ui_resp = requests.get(
						"https://www.googleapis.com/oauth2/v3/userinfo",
						headers={"Authorization": f"Bearer {access_token}"},
						timeout=10,
				)
				ui_data = ui_resp.json()
				email = ui_data.get("email")
				name = ui_data.get("name")
		except Exception as exc:  # noqa: BLE001
				return f"No se pudo obtener información del usuario desde Google: {exc}", 500

		if not email:
				return "Google no devolvió un correo electrónico válido.", 500

		existing_user = _get_user(str(email))
		if existing_user is not None and existing_user["status"] in {"suspended", "deleted"}:
				session.clear()
				return "Esta cuenta fue suspendida o eliminada por el administrador.", 403

		# Guardar/actualizar usuario en nuestra tabla local, incluyendo avatar si existe
		avatar_url = ui_data.get("picture")
		_upsert_user(name=name, email=email, avatar_url=avatar_url)

		# Calcular momento de expiración del access_token
		now_ts = _now_ts()
		access_expires_at = now_ts + int(expires_in or 0) if access_token and expires_in else None

		_save_google_tokens(
				email=email,
				refresh_token=str(refresh_token),
				access_token=str(access_token) if access_token else None,
				access_expires_at=access_expires_at,
		)

		# Crear sesión de la app
		session.permanent = True
		session["email"] = email
		if name:
				session["name"] = name
		if avatar_url:
				session["avatar_url"] = avatar_url

		# Registrar login en el historial de visitas
		_insert_visit(event_type="login", name=name, email=email, path="/auth/google/callback")

		# Redirigir a la página principal; el frontend podrá ya usar /api/drive/*
		return redirect("/")


@app.post("/api/session/login")
def api_session_login():
	"""Crea/actualiza una sesión de la app basada en correo.

	El frontend debe llamar a este endpoint después de un login exitoso con Google,
	enviando al menos {"email": "...", "name": "..."}.

	La información sensible (tokens de Google) NO se guarda aquí; solo se
	mantiene una sesión propia de la app usando cookies HttpOnly.
	"""

	data = request.get_json(silent=True) or {}
	email = str(data.get("email") or "").strip()
	name = data.get("name") or None
	avatar_url = data.get("avatar_url") or None

	if not email:
			return jsonify({"ok": False, "error": "missing_email"}), 400

	# Comprobar si el usuario está bloqueado
	user = _get_user(email)
	if user is not None and user["status"] in {"suspended", "deleted"}:
			return (
					jsonify(
							{
									"ok": False,
									"blocked": True,
									"status": user["status"],
							},
					),
					403,
			)

	# Asegurar que exista/actualizar en la tabla de usuarios
	_upsert_user(name=name, email=email, avatar_url=avatar_url)
	row = _get_user(email)
	effective, stored, expires_ts = _calculate_effective_plan(row)

	# Crear sesión de la app (cookie firmada, HttpOnly)
	session.permanent = True
	session["email"] = email
	if name:
			session["name"] = name
	if avatar_url:
			session["avatar_url"] = avatar_url

	avatar_url: str | None = None
	if row is not None and "avatar_url" in row.keys():  # type: ignore[operator]
			avatar_url = row["avatar_url"]  # type: ignore[index]

	return jsonify(
			{
					"ok": True,
					"email": email,
					"name": name,
					"avatar_url": avatar_url,
					"plan_id": effective,
					"raw_plan": stored,
					"expires_at_ts": expires_ts,
			},
	)


@app.get("/api/session/me")
def api_session_me():
	"""Devuelve la sesión actual de la app basada en la cookie.

	Sirve para que el frontend restaure el estado de login sin tener que pedir
	un nuevo token de Google inmediatamente.
	"""

	email = session.get("email")
	name = session.get("name")
	if not email:
			return jsonify({"ok": False, "authenticated": False}), 200

	# Asegurar que el usuario exista en BD incluso si por alguna razón
	# solo tenemos la sesión de Flask (por ejemplo, tras un cambio de versión
	# o limpieza parcial de la base de datos).
	row = _get_user(email)
	if row is not None and row["status"] in {"suspended", "deleted"}:
			suspended_status = row["status"]
			session.clear()
			return jsonify({"ok": False, "authenticated": False, "blocked": True, "status": suspended_status}), 403
	if row is None:
			_upsert_user(name=name, email=email, avatar_url=session.get("avatar_url"))
			row = _get_user(email)
	effective, stored, expires_ts = _calculate_effective_plan(row)
	avatar_url: str | None = None
	if row is not None and "avatar_url" in row.keys():  # type: ignore[operator]
			avatar_url = row["avatar_url"]  # type: ignore[index]

	return jsonify(
			{
					"ok": True,
					"authenticated": True,
					"email": email,
					"name": name or (row["name"] if row is not None else None),
					"avatar_url": avatar_url,
					"plan_id": effective,
					"raw_plan": stored,
					"expires_at_ts": expires_ts,
			},
	)


@app.post("/api/session/logout")
def api_session_logout():
	"""Cierra la sesión de la app limpiando la cookie firmada."""

	session.clear()
	return jsonify({"ok": True})


def _require_app_session() -> str | None:
		"""Devuelve el email de la sesión actual o None si no hay sesión."""

		email = session.get("email")
		if not email:
				return None
		user = _get_user(str(email))
		if user is not None and user["status"] in {"suspended", "deleted"}:
				session.clear()
				return None
		return str(email)


def _delete_account_completely(email: str) -> None:
		"""Elimina por completo todos los datos asociados a un email.

		- Anonimiza el historial (visits) borrando nombre/correo.
		- Elimina snapshots de horario, tokens de Google y clientes de Stripe.
		- Elimina el registro principal de la tabla users.
		"""

		if not email:
				return

		conn = get_db_connection()
		cur = conn.cursor()
		# Anonimizar historial para que no quede correo asociado
		cur.execute("DELETE FROM visits WHERE email = ?", (email,))
		# Eliminar datos ligados a la cuenta
		cur.execute("DELETE FROM schedules WHERE email = ?", (email,))
		cur.execute("DELETE FROM google_tokens WHERE email = ?", (email,))
		cur.execute("DELETE FROM stripe_customers WHERE email = ?", (email,))
		cur.execute("DELETE FROM users WHERE email = ?", (email,))
		conn.commit()
		conn.close()


@app.post("/api/drive/save")
def api_drive_save():
		"""Guarda el horario del usuario en Google Drive (appDataFolder) desde el backend.

		El frontend envía el mismo JSON que antes se subía desde JavaScript. Aquí solo
		se recibe y se guarda en el archivo horario_data.json del espacio appDataFolder
		usando la API REST de Drive con el access_token renovado desde el servidor.
		"""

		email = _require_app_session()
		if not email:
				return jsonify({"ok": False, "error": "not_authenticated"}), 401

		payload = request.get_json(silent=True)
		if payload is None:
				return jsonify({"ok": False, "error": "invalid_json"}), 400

		access_token = _get_fresh_google_access_token(email)
		if not access_token:
				return jsonify({"ok": False, "error": "no_drive_token"}), 403

		file_name = "horario_data.json"
		content = jsonify(payload).get_data(as_text=True)

		headers = {"Authorization": f"Bearer {access_token}"}

		try:
				# Buscar si ya existe el archivo en appDataFolder
				list_resp = requests.get(
						"https://www.googleapis.com/drive/v3/files",
						params={
								"spaces": "appDataFolder",
								"q": f"name='{file_name}' and trashed=false",
								"fields": "files(id, name, modifiedTime)",
								"pageSize": 1,
						},
						headers=headers,
						timeout=10,
				)
				list_data = list_resp.json()
				files = list_data.get("files") or []
				file_id = files[0]["id"] if files else None

				if file_id:
						# Actualizar contenido existente (subida simple media)
						update_resp = requests.patch(
								f"https://www.googleapis.com/upload/drive/v3/files/{file_id}",
								params={"uploadType": "media"},
								data=content,
								headers={
										"Authorization": f"Bearer {access_token}",
										"Content-Type": "application/json",
								},
								timeout=10,
						)
						update_resp.raise_for_status()
				else:
						# Crear archivo nuevo con subida multipart sencilla
						metadata = {"name": file_name, "parents": ["appDataFolder"]}
						files_payload = {
								"data": ("metadata", jsonify(metadata).get_data(as_text=True), "application/json; charset=UTF-8"),
								"file": (file_name, content, "application/json"),
						}
						create_resp = requests.post(
								"https://www.googleapis.com/upload/drive/v3/files",
								params={"uploadType": "multipart"},
								files=files_payload,
								headers={"Authorization": f"Bearer {access_token}"},
								timeout=10,
						)
						create_resp.raise_for_status()
		except Exception as exc:  # noqa: BLE001
				return jsonify({"ok": False, "error": f"drive_error: {exc}"}), 500

		return jsonify({"ok": True})


@app.post("/api/account/delete")
def api_account_delete():
		"""Elimina por completo la cuenta del usuario autenticado.

		Borra todos los datos asociados al correo en la base de datos y cierra
		la sesión de la app. No se elimina nada dentro de la cuenta de Google
		del usuario (Drive, Gmail), solo los registros locales de este sistema.
		"""

		email = _require_app_session()
		if not email:
				return jsonify({"ok": False, "error": "not_authenticated"}), 401

		# Registrar un evento anónimo de eliminación de cuenta (sin correo)
		try:
				_insert_visit(
						"account_deleted",
						name=None,
						email=None,
						path=request.path,
				)
		except Exception:  # noqa: BLE001
				# No bloquear la eliminación si el log falla
				pass

		# Eliminar también el archivo privado creado por esta aplicación en Drive
		# antes de borrar el token de Google de la base de datos.
		drive_deleted = False
		try:
				access_token = _get_fresh_google_access_token(email)
				if access_token:
						headers = {"Authorization": f"Bearer {access_token}"}
						list_resp = requests.get(
								"https://www.googleapis.com/drive/v3/files",
								params={
										"spaces": "appDataFolder",
										"q": "name='horario_data.json' and trashed=false",
										"fields": "files(id)",
										"pageSize": 100,
								},
								headers=headers,
								timeout=10,
						)
						list_resp.raise_for_status()
						files = (list_resp.json() or {}).get("files") or []
						for drive_file in files:
								delete_resp = requests.delete(
										f"https://www.googleapis.com/drive/v3/files/{drive_file['id']}",
										headers=headers,
										timeout=10,
								)
								delete_resp.raise_for_status()
						drive_deleted = True
		except Exception as exc:  # noqa: BLE001
				app.logger.warning("No se pudo eliminar horario_data.json de Drive: %s", exc)

		_delete_account_completely(email)
		# Cerrar sesión de la app (cookie firmada)
		session.clear()
		return jsonify({"ok": True, "drive_deleted": drive_deleted})


@app.post("/api/schedule/save")
def api_schedule_save() -> "flask.Response":  # type: ignore[name-defined]
		"""Guarda un snapshot del horario del usuario en la BD.

		Se usa como respaldo/local cache adicional a Google Drive para que,
		aunque falle Drive o aún no haya tokens, la app pueda recordar el
		último horario conocido al volver a iniciar sesión.
		"""

		email = _require_app_session()
		if not email:
				return jsonify({"ok": False, "error": "not_authenticated"}), 401

		payload = request.get_json(silent=True)
		if payload is None:
				return jsonify({"ok": False, "error": "invalid_json"}), 400

		try:
				blob = json.dumps(payload, ensure_ascii=False)
		except Exception:
				return jsonify({"ok": False, "error": "serialize_error"}), 400

		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute(
				"""
				INSERT INTO schedules (email, data, updated_at)
				VALUES (?, ?, ?)
				ON CONFLICT(email) DO UPDATE SET
						data = excluded.data,
						updated_at = excluded.updated_at
				""",
				(email, blob, _now_iso()),
		)
		conn.commit()
		conn.close()
		return jsonify({"ok": True})


@app.get("/api/schedule/load")
def api_schedule_load() -> "flask.Response":  # type: ignore[name-defined]
		"""Devuelve el último snapshot del horario guardado en la BD.

		Si no existe registro devuelve una respuesta vacía normal.
		"""

		email = _require_app_session()
		if not email:
				return jsonify({"ok": False, "error": "not_authenticated"}), 401

		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute("SELECT data, updated_at FROM schedules WHERE email = ?", (email,))
		row = cur.fetchone()
		conn.close()
		if row is None:
				return jsonify({"ok": True, "found": False, "data": None}), 200

		try:
				data = json.loads(row["data"])
		except Exception:
				return jsonify(
						{
								"ok": False,
								"error": "corrupt_schedule",
						},
				), 500

		return jsonify({"ok": True, "data": data, "updated_at": row["updated_at"]})


@app.get("/api/drive/load")
def api_drive_load():
		"""Carga el horario del usuario desde Google Drive (appDataFolder).

		Devuelve el JSON previamente guardado en horario_data.json o un error si no
		existe o no hay sesión/tokens.
		"""

		email = _require_app_session()
		if not email:
				return jsonify({"ok": False, "error": "not_authenticated"}), 401

		access_token = _get_fresh_google_access_token(email)
		if not access_token:
				return jsonify({"ok": False, "error": "no_drive_token"}), 403

		file_name = "horario_data.json"
		headers = {"Authorization": f"Bearer {access_token}"}

		try:
				# Buscar archivo en appDataFolder
				list_resp = requests.get(
						"https://www.googleapis.com/drive/v3/files",
						params={
								"spaces": "appDataFolder",
								"q": f"name='{file_name}' and trashed=false",
								"fields": "files(id, name, modifiedTime)",
								"pageSize": 1,
						},
						headers=headers,
						timeout=10,
				)
				list_data = list_resp.json()
				files = list_data.get("files") or []
				if not files:
						return jsonify({"ok": True, "found": False, "data": None}), 200

				file_id = files[0]["id"]
				content_resp = requests.get(
						f"https://www.googleapis.com/drive/v3/files/{file_id}",
						params={"alt": "media"},
						headers=headers,
						timeout=10,
				)
				text = content_resp.text
				try:
						data = content_resp.json()
				except Exception:
						# Si no es JSON válido devolvemos el texto bruto
						return jsonify({"ok": True, "raw": text})
		except Exception as exc:  # noqa: BLE001
				return jsonify({"ok": False, "error": f"drive_error: {exc}"}), 500

		return jsonify({"ok": True, "data": data})


@app.get("/panel")
def panel_control():
	"""Página de panel con menú para historial, usuarios y vistas.

	Se sirve como un HTML estático (panel.html) en la raíz del proyecto.
	"""

	if not session.get("admin_authenticated"):
		return redirect("/admin/login")
	return app.send_static_file("panel.html")


@app.post("/track")
def track_event():
		"""Endpoint genérico para registrar visitas y sesiones desde JavaScript.

		Espera JSON como:
		{
				"event_type": "page_view" | "login",
				"name": "...",   # opcional
				"email": "...",  # opcional
				"path": "/ruta"  # opcional
		}
		"""

		data = request.get_json(silent=True) or {}
		event_type = str(data.get("event_type") or "page_view")
		name = data.get("name") or None
		email = data.get("email") or None
		path = data.get("path") or None

		if email:
			# Si el usuario está suspendido o eliminado, bloquear el uso de la cuenta
			user = _get_user(email)
			if user is not None and user["status"] in {"suspended", "deleted"}:
				return (
					jsonify(
						{
							"ok": False,
							"blocked": True,
							"status": user["status"],
						},
					),
					403,
				)
			_upsert_user(name, email)

		_insert_visit(event_type=event_type, name=name, email=email, path=path)

		return jsonify({"ok": True})


def _increment_usage_counter(email: str, field: str, free_limit: int | None) -> tuple[bool, dict]:
	"""Incrementa un contador de uso y aplica límites según el plan.

	Actualmente:
	- Plan free: consulta horarios oficiales, pero no consume funciones Pro.
	- Plan Plan_xunu: límite fijo de 10 usos por tipo (crear, imprimir, descargar).

	Devuelve (allowed, payload) donde payload es un dict listo para devolver al frontend.
	"""

	if not email:
		return False, {
				"allowed": False,
				"reason": "missing_email",
		}

	# Asegurar que exista el usuario
	_upsert_user(name=None, email=email)
	conn = get_db_connection()
	cur = conn.cursor()
	cur.execute(
			"""
			SELECT
				email,
				name,
				first_seen,
				last_seen,
				status,
				plan,
				plan_expires_at,
				catalog_created_count,
				print_count,
				download_count
			FROM users
			WHERE email = ?
			""",
			(email,),
	)
	row = cur.fetchone()
	if row is not None and row["status"] in {"suspended", "deleted"}:
		conn.close()
		return False, {
				"allowed": False,
				"blocked": True,
				"reason": row["status"],
		}
	effective, stored, expires_ts = _calculate_effective_plan(row)

	current_value = 0
	if row is not None and field in row.keys():  # type: ignore[operator]
		value = row[field]
		try:
				current_value = int(value) if value is not None else 0
		except (TypeError, ValueError):
				current_value = 0

	limit_free = free_limit
	# Límite para planes de pago (por ahora solo Plan_xunu)
	limit_paid: int | None = None
	if effective == "Plan_xunu":
		limit_paid = 10

	allowed = True
	reason = "ok"
	active_limit: int | None = None
	if effective == "free" and limit_free is not None:
		active_limit = limit_free
	elif effective != "free" and limit_paid is not None:
		active_limit = limit_paid

	if active_limit is not None and current_value >= active_limit:
		allowed = False
		reason = "limit_reached"
	else:
		new_value = current_value + 1
		cur.execute(f"UPDATE users SET {field} = ? WHERE email = ?", (new_value, email))
		conn.commit()
		current_value = new_value

	conn.close()
	payload: dict = {
			"allowed": allowed,
			"reason": reason,
			"plan_id": effective,
			"raw_plan": stored,
			"expires_at_ts": expires_ts,
			"current_value": current_value,
			"limit_free": limit_free,
			"limit_paid": limit_paid,
			"active_limit": active_limit,
	}
	return allowed, payload


def _require_admin() -> None:
		expected = os.environ.get("ADMIN_TOKEN")
		if not expected:
				return abort(503, "ADMIN_TOKEN no esta configurado")
		if session.get("admin_authenticated"):
				return
		token_req = request.headers.get("X-Admin-Token") or request.args.get("token") or ""
		if not hmac.compare_digest(str(token_req), str(expected)):
				return abort(401)


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
		expected = os.environ.get("ADMIN_TOKEN")
		error = None
		if request.method == "POST":
				password = request.form.get("password") or ""
				if not expected:
						error = "Configura ADMIN_TOKEN en el archivo .env y reinicia el servidor."
				elif hmac.compare_digest(password, expected):
						session["admin_authenticated"] = True
						session["admin_csrf"] = secrets.token_urlsafe(24)
						return redirect("/panel")
				else:
						error = "Contraseña incorrecta."

		return render_template_string(
				"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acceso administrativo</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#020617;color:#e5e7eb;font-family:system-ui,sans-serif}
.login{width:min(380px,calc(100vw - 40px));box-sizing:border-box;padding:30px;border:1px solid #1e293b;border-radius:20px;background:#0f172a;box-shadow:0 24px 60px #0008}
h1{margin:0 0 8px;font-size:1.55rem}p{margin:0 0 20px;color:#94a3b8}label{display:block;margin-bottom:7px;font-weight:700}
input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #334155;border-radius:10px;background:#020617;color:#fff;font-size:1rem}
button{width:100%;margin-top:14px;padding:12px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}.error{margin-top:12px;color:#fca5a5}
</style></head><body><form class="login" method="post"><h1>Panel administrativo</h1><p>Introduce tu contraseña de administrador.</p>
<label for="password">Contraseña</label><input id="password" name="password" type="password" required autofocus autocomplete="current-password">
<button type="submit">Entrar al panel</button>{% if error %}<div class="error">{{ error }}</div>{% endif %}</form></body></html>""",
				error=error,
		)


@app.get("/admin/logout")
def admin_logout():
		session.pop("admin_authenticated", None)
		session.pop("admin_csrf", None)
		return redirect("/admin/login")


def _require_admin_csrf() -> None:
		_require_admin()
		expected = session.get("admin_csrf") or ""
		received = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token") or ""
		if not expected or not hmac.compare_digest(str(received), str(expected)):
				return abort(403)


@app.post("/api/plan/debug-activate")
def api_plan_debug_activate():
		"""Endpoint de prueba para activar manualmente un plan.

		Solo debe usarse en desarrollo. Protegido con ADMIN_TOKEN.
		Ejemplo de uso:
		  POST /api/plan/debug-activate?token=admin {"email": "correo@ejemplo.com", "plan_id": "Plan_xunu"}
		"""

		_require_admin()
		data = request.get_json(silent=True) or {}
		email = str(data.get("email") or "").strip()
		plan_id = str(data.get("plan_id") or "Plan_xunu").strip() or "Plan_xunu"
		name = data.get("name") or None

		if not email:
				return jsonify({"ok": False, "error": "missing_email"}), 400
		if plan_id not in PLAN_DURATIONS_DAYS:
				return jsonify({"ok": False, "error": "invalid_plan"}), 400

		_activate_plan_for_user(email=email, plan_id=plan_id, name=name)
		row = _get_user(email)
		effective, stored, expires_ts = _calculate_effective_plan(row)
		return jsonify(
				{
						"ok": True,
						"plan_id": effective,
						"raw_plan": stored,
						"expires_at_ts": expires_ts,
						"now_ts": _now_ts(),
				},
		)


@app.get("/historial")
def historial():
		"""Página sencilla con el historial de visitas."""

		# Proteger la vista con un token de administrador
		_require_admin()

		conn = get_db_connection()
		cur = conn.cursor()
		# Resumen: una fila por correo con cuántas veces inició sesión
		cur.execute(
				"""
				SELECT
					email,
					MAX(name) AS name,
					COUNT(*) AS login_count,
					MIN(ts) AS first_login,
					MAX(ts) AS last_login
				FROM visits
				WHERE event_type = 'login'
					AND email IS NOT NULL
				GROUP BY email
				ORDER BY last_login DESC
				"""
		)
		login_rows_raw = cur.fetchall()
		login_rows = []
		for r in login_rows_raw:
				login_rows.append(
						{
								"email": r["email"],
								"name": r["name"],
								"login_count": r["login_count"],
								"first_login": _format_ts_for_display(r["first_login"]),
								"last_login": _format_ts_for_display(r["last_login"]),
						},
				)

		# Resumen: dispositivos anónimos (misma IP + navegador) y cuántas veces abrieron la página
		cur.execute(
				"""
				SELECT
					ip,
					user_agent,
					COUNT(*) AS page_views
				FROM visits
				WHERE event_type = 'page_view'
					AND email IS NULL
					AND ip IS NOT NULL
				GROUP BY ip, user_agent
				ORDER BY page_views DESC
				"""
		)
		anon_device_rows = cur.fetchall()

		# Resumen: cuántas veces se visitó cada ruta (path) de la app
		cur.execute(
				"""
				SELECT
					path,
					COUNT(*) AS page_views
				FROM visits
				WHERE path IS NOT NULL
					AND event_type = 'page_view'
				GROUP BY path
				ORDER BY page_views DESC
				""",
		)
		page_rows = cur.fetchall()

		# Detalle: últimas 500 interacciones, por si algún día quieres verlo
		cur.execute(
				"SELECT ts, ip, user_agent, path, event_type, name, email FROM visits ORDER BY id DESC LIMIT 500"
		)
		rows_raw = cur.fetchall()
		rows = []
		for r in rows_raw:
				rows.append(
						{
								"ts": _format_ts_for_display(r["ts"]),
								"ip": r["ip"],
								"user_agent": r["user_agent"],
								"path": r["path"],
								"event_type": r["event_type"],
								"name": r["name"],
								"email": r["email"],
						},
				)
		conn.close()

		html = render_template_string(
				"""<!doctype html>
<html lang="es">
<head>
	<meta charset="utf-8">
	<title>Historial de visitas</title>
	<style>
		body { font-family: system-ui, sans-serif; background:#0f172a; color:#e5e7eb; padding:20px; }
		h1 { margin-bottom: 1rem; }
		table { width:100%; border-collapse: collapse; font-size:14px; }
		th, td { border-bottom:1px solid #1f2937; padding:6px 8px; text-align:left; }
		th { background:#111827; position:sticky; top:0; }
		tr:nth-child(even) { background:#020617; }
		.tag { display:inline-block; padding:2px 6px; border-radius:999px; font-size:12px; }
		.tag-view { background:#1f2937; color:#e5e7eb; }
		.tag-login { background:#22c55e22; color:#4ade80; border:1px solid #22c55e55; }
		.small { color:#9ca3af; font-size:12px; }
	</style>
</head>
<body>
	<form method="post" action="/historial/clear" style="margin-bottom:1rem;" onsubmit="return confirm('Esto borrará TODO el historial de visitas (incluye logins y vistas anónimas). ¿Quieres continuar?');">
		<input type="hidden" name="csrf_token" value="{{ csrf_token }}">
		<button type="submit" style="background:#b91c1c;color:#f9fafb;border:none;border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;">Borrar todo el historial</button>
	</form>
	<h1>Resumen de inicios de sesión</h1>
	<p class="small">Una fila por cuenta (correo) indicando cuántas veces se ha iniciado sesión desde ese correo.</p>
	<table>
		<thead>
			<tr>
				<th>Correo</th>
				<th>Nombre</th>
				<th>Veces que inició sesión</th>
				<th>Primera vez (hora local)</th>
				<th>Última vez (hora local)</th>
			</tr>
		</thead>
		<tbody>
			{% for r in login_rows %}
			<tr>
				<td>{{ r["email"] }}</td>
				<td>{{ r["name"] or "-" }}</td>
				<td>{{ r["login_count"] }}</td>
				<td class="small">{{ r["first_login"] }}</td>
				<td class="small">{{ r["last_login"] }}</td>
			</tr>
			{% endfor %}
		</tbody>
	</table>

	<h1 style="margin-top:2rem;">Visitas sin iniciar sesión (por dispositivo)</h1>
	<p class="small">Se agrupan las visitas anónimas (sin correo) por el mismo dispositivo (IP + navegador).</p>
	<table>
		<thead>
			<tr>
				<th>IP</th>
				<th>User-Agent</th>
				<th>Veces que abrió la página</th>
				<th>Resumen</th>
			</tr>
		</thead>
		<tbody>
			{% for r in anon_device_rows %}
			<tr>
				<td>{{ r["ip"] }}</td>
				<td class="small">{{ r["user_agent"] }}</td>
				<td>{{ r["page_views"] }}</td>
				<td>Este dispositivo visitó la página {{ r["page_views"] }} veces.</td>
			</tr>
			{% endfor %}
		</tbody>
	</table>

	<h1 style="margin-top:2rem;">Visitas por página (ruta)</h1>
	<p class="small">Contador de cuántas veces se visitó cada ruta de la app (eventos "page_view").</p>
	<table>
		<thead>
			<tr>
				<th>Ruta</th>
				<th>Veces que se visitó</th>
			</tr>
		</thead>
		<tbody>
			{% for r in page_rows %}
			<tr>
				<td>{{ r["path"] or "-" }}</td>
				<td>{{ r["page_views"] }}</td>
			</tr>
			{% endfor %}
		</tbody>
	</table>

	<h1 style="margin-top:2rem;">Historial de visitas (detalle)</h1>
	<p class="small">Se muestran las últimas 500 interacciones. "page_view" es solo abrir la página; "login" implica sesión con nombre/correo.</p>
	<table>
		<thead>
			<tr>
				<th>Fecha y hora (local)</th>
				<th>Tipo</th>
				<th>Nombre</th>
				<th>Correo</th>
				<th>Ruta</th>
				<th>IP</th>
				<th>User-Agent</th>
			</tr>
		</thead>
		<tbody>
			{% for r in rows %}
			<tr>
				<td>{{ r["ts"] }}</td>
				<td>
					{% if r["event_type"] == "login" %}
						<span class="tag tag-login">login</span>
					{% else %}
						<span class="tag tag-view">{{ r["event_type"] or "page_view" }}</span>
					{% endif %}
				</td>
				<td>{{ r["name"] or "-" }}</td>
				<td>{{ r["email"] or "-" }}</td>
				<td>{{ r["path"] or "-" }}</td>
				<td>{{ r["ip"] or "-" }}</td>
				<td class="small">{{ r["user_agent"] or "-" }}</td>
			</tr>
			{% endfor %}
		</tbody>
	</table>
</body>
</html>
""",
			rows=rows,
			login_rows=login_rows,
			anon_device_rows=anon_device_rows,
			page_rows=page_rows,
			csrf_token=session.get("admin_csrf") or "",
		)
		return html


@app.post("/historial/clear")
def historial_clear():
		"""Borra todos los registros de la tabla visits (historial completo).

		Protegido con ADMIN_TOKEN mediante _require_admin.
		"""

		_require_admin_csrf()
		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute("DELETE FROM visits")
		conn.commit()
		conn.close()

		# Mantener el mismo token en la redirección, si existe
		return redirect("/historial")


@app.get("/usuarios")
def usuarios():
		"""Listado de usuarios que han iniciado sesión y su estado."""

		_require_admin()

		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute(
				"""
				SELECT email, name, first_seen, last_seen, status, plan, plan_expires_at
				FROM users
				ORDER BY last_seen DESC
				""",
		)
		rows = cur.fetchall()

		# Enriquecer con el plan efectivo (free o de pago)
		users: list[dict] = []
		for u in rows:
				effective, stored, expires_ts = _calculate_effective_plan(u)
				users.append(
						{
								"email": u["email"],
								"name": u["name"],
								"first_seen": _format_ts_for_display(u["first_seen"]),
								"last_seen": _format_ts_for_display(u["last_seen"]),
								"status": u["status"],
								"plan": effective,
								"raw_plan": stored,
								"expires_ts": expires_ts,
						},
				)
		conn.close()

		html = render_template_string(
				"""<!doctype html>
<html lang="es">
<head>
	<meta charset="utf-8">
	<title>Usuarios registrados</title>
	<style>
		body { font-family: system-ui, sans-serif; background:#020617; color:#e5e7eb; padding:20px; }
		h1 { margin-bottom: 1rem; }
		table { width:100%; border-collapse: collapse; font-size:14px; }
		th, td { border-bottom:1px solid #1f2937; padding:6px 8px; text-align:left; }
		th { background:#030712; position:sticky; top:0; }
		tr:nth-child(even) { background:#020617; }
		.status { padding:2px 6px; border-radius:999px; font-size:12px; }
		.status-active { background:#22c55e22; color:#4ade80; border:1px solid #22c55e55; }
		.status-suspended { background:#f9731622; color:#fdba74; border:1px solid #f9731655; }
		.status-deleted { background:#ef444422; color:#fecaca; border:1px solid #ef444455; }
		.plan { padding:2px 6px; border-radius:999px; font-size:12px; border:1px solid #4b5563; }
		.plan-free { background:#0b1120; color:#9ca3af; }
		.plan-paid { background:#22c55e22; color:#4ade80; border-color:#22c55e55; }
		form { display:inline-block; margin-right:4px; }
		button { font-size:11px; padding:2px 6px; border-radius:999px; border:none; cursor:pointer; }
		.btn-suspend { background:#f97316; color:#111827; }
		.btn-delete { background:#ef4444; color:#f9fafb; }
		.btn-activate { background:#22c55e; color:#022c22; }
		.small { color:#9ca3af; font-size:12px; }
	</style>
</head>
<body>
	<h1>Usuarios que iniciaron sesión</h1>
	<p class="small">Desde aquí puedes suspender o marcar como eliminadas cuentas por correo. Esto NO elimina datos en Google, solo en tu registro local.</p>
	<table>
		<thead>
			<tr>
				<th>Correo</th>
				<th>Nombre</th>
				<th>Primera vez (hora local)</th>
				<th>Última vez (hora local)</th>
				<th>Plan</th>
				<th>Estado</th>
				<th>Acciones</th>
			</tr>
		</thead>
		<tbody>
			{% for u in users %}
			<tr>
				<td>{{ u["email"] }}</td>
				<td>{{ u["name"] or "-" }}</td>
				<td class="small">{{ u["first_seen"] }}</td>
				<td class="small">{{ u["last_seen"] }}</td>
				<td>
					{% if u["plan"] == "free" %}
						<span class="plan plan-free">Gratis</span>
					{% elif u["plan"] == "plus_30" %}
						<span class="plan plan-paid">plan_xunu</span>
					{% else %}
						<span class="plan plan-paid">Pago ({{ u["plan"] }})</span>
					{% endif %}
				</td>
				<td>
					<span class="status status-{{ u['status'] }}">{{ u["status"] }}</span>
				</td>
				<td>
					<form method="post" action="/usuarios/estado">
						<input type="hidden" name="csrf_token" value="{{ csrf_token }}">
						<input type="hidden" name="email" value="{{ u['email'] }}">
						<input type="hidden" name="status" value="active">
						<button type="submit" class="btn-activate">Activar</button>
					</form>
					<form method="post" action="/usuarios/estado">
						<input type="hidden" name="csrf_token" value="{{ csrf_token }}">
						<input type="hidden" name="email" value="{{ u['email'] }}">
						<input type="hidden" name="status" value="suspended">
						<button type="submit" class="btn-suspend">Suspender</button>
					</form>
					<form method="post" action="/usuarios/estado" onsubmit="return confirm('¿Marcar como eliminada esta cuenta?');">
						<input type="hidden" name="csrf_token" value="{{ csrf_token }}">
						<input type="hidden" name="email" value="{{ u['email'] }}">
						<input type="hidden" name="status" value="deleted">
						<button type="submit" class="btn-delete">Eliminar</button>
					</form>
				</td>
			</tr>
			{% endfor %}
		</tbody>
	</table>
</body>
</html>
""",
			users=users,
			csrf_token=session.get("admin_csrf") or "",
		)
		return html


@app.get("/login_resumen")
def login_resumen():
		"""Resumen: una fila por cuenta con cuántas veces inició sesión."""
		_require_admin()

		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute(
				"""
				SELECT
					email,
					MAX(name) AS name,
					COUNT(*) AS login_count,
					MIN(ts) AS first_login,
					MAX(ts) AS last_login
				FROM visits
				WHERE event_type = 'login'
					AND email IS NOT NULL
				GROUP BY email
				ORDER BY last_login DESC
				"""
		)
		rows_raw = cur.fetchall()

		# Formatear fechas a hora local legible
		rows: list[dict] = []
		for r in rows_raw:
				rows.append(
						{
								"email": r["email"],
								"name": r["name"],
								"login_count": r["login_count"],
								"first_login": _format_ts_for_display(r["first_login"]),
								"last_login": _format_ts_for_display(r["last_login"]),
						},
				)

		conn.close()

		html = render_template_string(
				"""<!doctype html>
<html lang="es">
<head>
	<meta charset="utf-8">
	<title>Resumen de inicios de sesión</title>
	<style>
		body { font-family: system-ui, sans-serif; background:#020617; color:#e5e7eb; padding:20px; }
		h1 { margin-bottom: 1rem; }
		table { width:100%; border-collapse: collapse; font-size:14px; }
		th, td { border-bottom:1px solid #1f2937; padding:6px 8px; text-align:left; }
		th { background:#030712; position:sticky; top:0; }
		tr:nth-child(even) { background:#020617; }
		.small { color:#9ca3af; font-size:12px; }
	</style>
</head>
<body>
	<h1>Resumen de inicios de sesión</h1>
	<p class="small">Una fila por cuenta (correo) indicando cuántas veces se ha iniciado sesión desde este dispositivo/correo.</p>
	<table>
		<thead>
			<tr>
				<th>Correo</th>
				<th>Nombre</th>
				<th>Veces que inició sesión</th>
				<th>Primera vez (hora local)</th>
				<th>Última vez (hora local)</th>
			</tr>
		</thead>
		<tbody>
			{% for r in rows %}
			<tr>
				<td>{{ r["email"] }}</td>
				<td>{{ r["name"] or "-" }}</td>
				<td>{{ r["login_count"] }}</td>
				<td class="small">{{ r["first_login"] }}</td>
				<td class="small">{{ r["last_login"] }}</td>
			</tr>
			{% endfor %}
		</tbody>
	</table>
</body>
</html>
""",
				rows=rows,
		)
		return html


@app.get("/ips")
def ips():
		"""Resumen por IP de cuántas veces se vio la página sin iniciar sesión."""
		_require_admin()

		conn = get_db_connection()
		cur = conn.cursor()
		# Contar solo vistas de página (page_view) sin correo asociado
		cur.execute(
				"""
				SELECT ip,
				       COUNT(*) AS anon_page_views
				FROM visits
				WHERE ip IS NOT NULL
				  AND event_type = 'page_view'
				  AND email IS NULL
				GROUP BY ip
				ORDER BY anon_page_views DESC
				"""
		)
		rows = cur.fetchall()
		conn.close()

		html = render_template_string(
				"""<!doctype html>
<html lang="es">
<head>
	<meta charset="utf-8">
	<title>Vistas anónimas por IP</title>
	<style>
		body { font-family: system-ui, sans-serif; background:#020617; color:#e5e7eb; padding:20px; }
		h1 { margin-bottom: 1rem; }
		table { width:100%; border-collapse: collapse; font-size:14px; }
		th, td { border-bottom:1px solid #1f2937; padding:6px 8px; text-align:left; }
		th { background:#030712; position:sticky; top:0; }
		tr:nth-child(even) { background:#020617; }
		.small { color:#9ca3af; font-size:12px; }
	</style>
</head>
<body>
	<h1>Vistas de página sin iniciar sesión (por IP)</h1>
	<p class="small">Aquí solo se cuentan las veces que se abrió la página y NO había un correo asociado (sin login).</p>
	<table>
		<thead>
			<tr>
				<th>IP</th>
				<th>Veces que abrió la página</th>
			</tr>
		</thead>
		<tbody>
			{% for r in rows %}
			<tr>
				<td>{{ r["ip"] }}</td>
				<td>{{ r["anon_page_views"] }}</td>
			</tr>
			{% endfor %}
		</tbody>
	</table>
</body>
</html>
""",
				rows=rows,
		)
		return html


@app.post("/usuarios/estado")
def actualizar_estado_usuario():
		"""Actualiza el estado de un usuario (activar/suspender/eliminar)."""
		_require_admin_csrf()

		email = request.form.get("email")
		status = request.form.get("status")

		if not email or status not in {"active", "suspended", "deleted"}:
				return redirect("/usuarios")

		conn = get_db_connection()
		cur = conn.cursor()
		if status == "deleted":
				# Conserva una marca para impedir que la cuenta vuelva a registrarse.
				cur.execute("UPDATE visits SET email = NULL, name = NULL WHERE email = ?", (email,))
				cur.execute("DELETE FROM schedules WHERE email = ?", (email,))
				cur.execute("DELETE FROM google_tokens WHERE email = ?", (email,))
				cur.execute("DELETE FROM stripe_customers WHERE email = ?", (email,))
				cur.execute("UPDATE users SET status = 'deleted', plan = 'free' WHERE email = ?", (email,))
		else:
				# Suspender o activar solo cambia el estado en la tabla de usuarios
				cur.execute("UPDATE users SET status = ? WHERE email = ?", (status, email))
		conn.commit()
		conn.close()

		return redirect("/usuarios")


@app.post("/api/invitation/redeem")
def api_invitation_redeem():
		"""Canjea una invitación una sola vez y concede 24 horas sin límites."""

		data = request.get_json(silent=True) or {}
		code = str(data.get("code") or "").strip()
		email = str(session.get("email") or "").strip()
		if not email:
				return jsonify({"ok": False, "reason": "login_required", "message": "Primero inicia sesión con Google."}), 401
		if not code or not INVITATION_CODE or not hmac.compare_digest(code.casefold(), INVITATION_CODE.casefold()):
				return jsonify({"ok": False, "reason": "invalid_code", "message": "Código no válido. Verifica tu invitación."}), 400

		row = _get_user(email)
		if row is None:
				_upsert_user(session.get("name"), email, session.get("avatar_url"))
				row = _get_user(email)
		if row is not None and row["status"] in {"suspended", "deleted"}:
				return jsonify({"ok": False, "reason": "account_blocked", "message": "Tu cuenta no puede activar esta invitación."}), 403
		if row is not None and row["plan"] == "Plan_xunu":
				return jsonify({"ok": False, "reason": "paid_plan_active", "message": "Tu cuenta ya tiene un plan activo."}), 409

		now_ts = _now_ts()
		redeemed_at = row["invitation_redeemed_at"] if row is not None else None
		invitation_status = (row["invitation_status"] if row is not None else None) or ""
		expires_raw = row["plan_expires_at"] if row is not None else None
		try:
				expires_ts = int(expires_raw) if expires_raw is not None else None
		except (TypeError, ValueError):
				expires_ts = None

		if redeemed_at:
				if invitation_status == "cancelled":
						message = "Tu acceso gratuito fue cancelado por el administrador."
				elif expires_ts is not None and expires_ts <= now_ts:
						message = "Tu código ya se venció."
				else:
						message = "Este código ya fue activado en tu cuenta."
				return jsonify({"ok": False, "reason": "already_redeemed", "message": message, "expires_at_ts": expires_ts}), 409

		expires_ts = now_ts + INVITATION_DURATION_SECONDS
		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute(
				"""
				UPDATE users
				SET plan = ?, plan_expires_at = ?, invitation_redeemed_at = ?, invitation_status = 'active'
				WHERE email = ?
				""",
				(INVITATION_PLAN_ID, str(expires_ts), _now_iso(), email),
		)
		conn.commit()
		conn.close()
		return jsonify({
				"ok": True,
				"plan_id": INVITATION_PLAN_ID,
				"expires_at_ts": expires_ts,
				"now_ts": now_ts,
				"message": "Código activado. Tienes acceso completo gratis durante 24 horas.",
		})


@app.get("/invitaciones")
def invitaciones_admin():
		"""Panel de cuentas que canjearon el acceso gratuito de 24 horas."""

		_require_admin()
		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute(
				"""
				SELECT email, name, plan, plan_expires_at, invitation_redeemed_at, invitation_status
				FROM users
				WHERE invitation_redeemed_at IS NOT NULL
				ORDER BY invitation_redeemed_at DESC
				"""
		)
		rows = cur.fetchall()
		conn.close()
		now_ts = _now_ts()
		invitees = []
		for row in rows:
				try:
						expires_ts = int(row["plan_expires_at"]) if row["plan_expires_at"] else None
				except (TypeError, ValueError):
						expires_ts = None
				stored_status = row["invitation_status"] or "active"
				if stored_status == "cancelled":
						display_status = "cancelled"
				elif expires_ts is None or expires_ts <= now_ts or row["plan"] != INVITATION_PLAN_ID:
						display_status = "expired"
				else:
						display_status = "active"
				invitees.append({
						"email": row["email"], "name": row["name"],
						"redeemed_at": _format_ts_for_display(row["invitation_redeemed_at"]),
						"expires_at": _format_epoch_for_display(expires_ts),
						"status": display_status,
				})

		return render_template_string("""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Accesos gratuitos de 24 horas</title>
<style>body{font-family:system-ui,sans-serif;background:#020617;color:#e5e7eb;padding:20px}a{color:#93c5fd}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #1f2937;text-align:left}.badge{padding:3px 8px;border-radius:999px;font-size:12px}.active{background:#14532d;color:#bbf7d0}.expired{background:#3f3f46;color:#d4d4d8}.cancelled{background:#7f1d1d;color:#fecaca}form{display:inline}button{border:0;border-radius:8px;padding:6px 10px;cursor:pointer;margin:2px}.activate{background:#22c55e}.cancel{background:#ef4444;color:white}</style></head><body>
<p><a href="/panel">← Volver al panel</a></p><h1>Accesos gratuitos de 24 horas</h1>
<p>Aquí aparecen todas las cuentas que utilizaron el código, incluso si su acceso venció o fue cancelado.</p>
<table><thead><tr><th>Correo</th><th>Nombre</th><th>Activado</th><th>Vence</th><th>Estado</th><th>Control</th></tr></thead><tbody>
{% for u in invitees %}<tr><td>{{ u.email }}</td><td>{{ u.name or '-' }}</td><td>{{ u.redeemed_at }}</td><td>{{ u.expires_at }}</td><td><span class="badge {{ u.status }}">{{ u.status }}</span></td><td>
<form method="post" action="/invitaciones/estado"><input type="hidden" name="csrf_token" value="{{ csrf_token }}"><input type="hidden" name="email" value="{{ u.email }}"><input type="hidden" name="action" value="activate"><button class="activate">Activar 24 h</button></form>
<form method="post" action="/invitaciones/estado" onsubmit="return confirm('¿Cancelar este acceso gratuito?')"><input type="hidden" name="csrf_token" value="{{ csrf_token }}"><input type="hidden" name="email" value="{{ u.email }}"><input type="hidden" name="action" value="cancel"><button class="cancel">Cancelar</button></form>
</td></tr>{% else %}<tr><td colspan="6">Nadie ha utilizado todavía el código.</td></tr>{% endfor %}</tbody></table></body></html>""", invitees=invitees, csrf_token=session.get("admin_csrf") or "")


@app.post("/invitaciones/estado")
def invitaciones_estado():
		_require_admin_csrf()
		email = str(request.form.get("email") or "").strip()
		action = str(request.form.get("action") or "").strip()
		if not email or action not in {"activate", "cancel"}:
				return redirect("/invitaciones")
		conn = get_db_connection()
		cur = conn.cursor()
		if action == "activate":
				expires_ts = _now_ts() + INVITATION_DURATION_SECONDS
				cur.execute("UPDATE users SET plan = ?, plan_expires_at = ?, invitation_status = 'active', invitation_redeemed_at = COALESCE(invitation_redeemed_at, ?) WHERE email = ?", (INVITATION_PLAN_ID, str(expires_ts), _now_iso(), email))
		else:
				cur.execute("UPDATE users SET plan = 'free', plan_expires_at = NULL, invitation_status = 'cancelled' WHERE email = ?", (email,))
		conn.commit()
		conn.close()
		return redirect("/invitaciones")


@app.post("/api/usage/catalog-create")
def api_usage_catalog_create():
		"""Registra la creación de una materia de catálogo.

		Plan gratuito: la creación manual es una función Pro.
		"""

		data = request.get_json(silent=True) or {}
		email = str(data.get("email") or "").strip()
		if not email:
				return jsonify({"allowed": False, "reason": "missing_email"}), 400

		allowed, payload = _increment_usage_counter(email, "catalog_created_count", free_limit=0)
		status_code = 200 if allowed else 403
		return jsonify(payload), status_code


@app.post("/api/usage/print")
def api_usage_print():
		"""Registra una impresión de horario.

		Plan gratuito: la impresión es una función Pro.
		"""

		data = request.get_json(silent=True) or {}
		email = str(data.get("email") or "").strip()
		if not email:
				return jsonify({"allowed": False, "reason": "missing_email"}), 400

		allowed, payload = _increment_usage_counter(email, "print_count", free_limit=0)
		status_code = 200 if allowed else 403
		return jsonify(payload), status_code


@app.post("/api/usage/download")
def api_usage_download():
		"""Registra una descarga de PDF (reinscripción).

		Plan gratuito: las descargas y envíos son funciones Pro.
		"""

		data = request.get_json(silent=True) or {}
		email = str(data.get("email") or "").strip()
		if not email:
				return jsonify({"allowed": False, "reason": "missing_email"}), 400

		allowed, payload = _increment_usage_counter(email, "download_count", free_limit=0)
		status_code = 200 if allowed else 403
		return jsonify(payload), status_code


@app.get("/api/usage/status")
def api_usage_status():
		"""Devuelve un resumen de usos por tipo (catálogo, impresión, descarga).

		Se usa en el frontend para mostrar al usuario cuántos usos ha
		consumido y cuántos le quedan con su plan actual.
		"""

		email = request.args.get("email") or None
		now_ts = _now_ts()

		# Límites del plan gratuito
		free_limits = {
				"catalog": 0,
				"print": 0,
				"download": 0,
		}

		if not email:
				return jsonify(
						{
								"plan_id": "free",
								"raw_plan": "free",
								"expires_at_ts": None,
								"now_ts": now_ts,
								"usage": {
										"catalog": {
												"current": 0,
												"remaining": None,
												"limit_free": free_limits["catalog"],
												"limit_paid": 10,
												"active_limit": None,
										},
										"print": {
												"current": 0,
												"remaining": None,
												"limit_free": free_limits["print"],
												"limit_paid": 10,
												"active_limit": None,
										},
										"download": {
												"current": 0,
												"remaining": None,
												"limit_free": free_limits["download"],
												"limit_paid": 10,
												"active_limit": None,
										},
								},
						},
				)

		row = _get_user(email)
		effective, stored, expires_ts = _calculate_effective_plan(row)

		def _field_info(field: str, free_limit: int | None) -> dict:
				current_value = 0
				if row is not None and field in row.keys():  # type: ignore[operator]
						value = row[field]
						try:
								current_value = int(value) if value is not None else 0
						except (TypeError, ValueError):
								current_value = 0

				limit_free = free_limit
				limit_paid: int | None = 10 if effective == "Plan_xunu" else None

				active_limit: int | None = None
				if effective == "free" and limit_free is not None:
						active_limit = limit_free
				elif effective != "free" and limit_paid is not None:
						active_limit = limit_paid

				remaining: int | None
				if active_limit is None:
						remaining = None
				else:
						remaining = max(active_limit - current_value, 0)

				return {
						"current": current_value,
						"remaining": remaining,
						"limit_free": limit_free,
						"limit_paid": limit_paid,
						"active_limit": active_limit,
				}

		usage = {
				"catalog": _field_info("catalog_created_count", free_limits["catalog"]),
				"print": _field_info("print_count", free_limits["print"]),
				"download": _field_info("download_count", free_limits["download"]),
		}

		return jsonify(
				{
						"plan_id": effective,
						"raw_plan": stored,
						"expires_at_ts": expires_ts,
						"now_ts": now_ts,
						"usage": usage,
				},
		)


@app.get("/api/plan/status")
def api_plan_status():
		"""Devuelve el plan actual de un usuario (por correo).

		Se usa desde el frontend para limitar funcionalidades.
		"""

		email = request.args.get("email") or None
		now_ts = _now_ts()
		if not email:
				return jsonify(
						{
								"plan_id": "free",
								"raw_plan": "free",
								"expires_at_ts": None,
								"now_ts": now_ts,
						}
				)

		row = _get_user(email)
		effective, stored, expires_ts = _calculate_effective_plan(row)
		return jsonify(
				{
						"plan_id": effective,
						"raw_plan": stored,
						"expires_at_ts": expires_ts,
						"now_ts": now_ts,
				}
		)


@app.post("/api/plan/activate-client")
def api_plan_activate_client():
		"""Los planes solo se activan mediante el webhook firmado de Stripe."""
		return jsonify({"ok": False, "error": "webhook_required"}), 403


@app.post("/api/checkout/create-session")
def api_create_checkout_session():
		"""Crea una sesión de Stripe Checkout para comprar un plan.

		El frontend envía: {"plan_id": "basic_20"|"Plan_xunu"|"pro_50", "email": "...", "name": "..."}
		"""

		if stripe is None or not _has_valid_stripe_secret_key():
				return (
						jsonify({"error": "error contacta con el desarrollador."}),
					503,
				)

		data = request.get_json(silent=True) or {}
		plan_id = str(data.get("plan_id") or "")
		email = _require_app_session()
		name = str(session.get("name") or "").strip() or None

		if plan_id not in PLAN_DURATIONS_DAYS:
				return jsonify({"error": "Plan no válido."}), 400
		if not email:
				return jsonify({"error": "Debes iniciar sesión antes de comprar un plan."}), 401

		price_id = STRIPE_PRICE_IDS.get(plan_id)
		if not price_id:
				return (
						jsonify({"error": "El precio de Stripe para este plan no está configurado en el servidor."}),
					500,
				)

		base_url = request.url_root.rstrip("/")
		try:
				session = stripe.checkout.Session.create(
						mode="payment",
						payment_method_types=["card"],
						line_items=[{"price": price_id, "quantity": 1}],
						success_url=f"{base_url}/pago-exitoso?session_id={{CHECKOUT_SESSION_ID}}",
						cancel_url=f"{base_url}/pago-cancelado",
						metadata={
								"plan_id": plan_id,
								"email": email,
								"name": name or "",
						},
				)
		except Exception as exc:  # noqa: BLE001
				return jsonify({"error": f"No se pudo crear la sesión de pago: {exc}"}), 500

		return jsonify({"sessionId": session.id, "publishableKey": STRIPE_PUBLISHABLE_KEY})


@app.post("/api/payment/create-intent")
def api_create_payment_intent():
	"""Crea un PaymentIntent para pagar un plan dentro de la propia página.

	El frontend envía: {"plan_id": "Plan_xunu", "email": "...", "name": "..."}
	"""

	if stripe is None or not _has_valid_stripe_secret_key():
		return (
				jsonify({"error": "error contacta con el desarrollador."}),
			503,
		)

	data = request.get_json(silent=True) or {}
	plan_id = str(data.get("plan_id") or "")
	email = _require_app_session()
	name = str(session.get("name") or "").strip() or None

	if plan_id not in PLAN_DURATIONS_DAYS:
		return jsonify({"error": "Plan no válido."}), 400
	if not email:
		return jsonify({"error": "Debes iniciar sesión antes de comprar un plan."}), 401

	# Monto fijo para el plan Plan_xunu: 49.99 MXN
	amount = 4999  # en centavos de MXN

	# Intentar asociar un Customer para que Stripe pueda recordar métodos de pago
	customer_id = _get_or_create_stripe_customer(email=email, name=name)

	params: dict = {
			"amount": amount,
			"currency": "mxn",
			"metadata": {
					"plan_id": plan_id,
					"email": email,
					"name": name or "",
			},
			"description": "Plan Horarios Bio 49.99 MXN (10 usos)",
			# Habilita métodos automáticos (tarjeta y otros compatibles en MX)
			"automatic_payment_methods": {"enabled": True},
	}
	# Asociar el pago al cliente sin autorizar cargos futuros: este plan es de pago único.
	if customer_id:
		params["customer"] = customer_id

	try:
		intent = stripe.PaymentIntent.create(**params)  # type: ignore[call-arg]
	except Exception as exc:  # noqa: BLE001
		# Caso típico al cambiar de modo test/live: en la BD queda
		# guardado un customer de Stripe que pertenece a otro entorno
		# y Stripe responde "No such customer".
		msg = str(exc)
		if customer_id and "No such customer" in msg:
			conn = None
			try:
				conn = get_db_connection()
				cur = conn.cursor()
				cur.execute("DELETE FROM stripe_customers WHERE email = ?", (email,))
				conn.commit()
			except Exception:
				# Si falla el borrado, continuamos con el reintento sin customer.
				pass
			finally:
				if conn is not None:
					try:
						conn.close()
					except Exception:
						pass

			# Reintentar crear el PaymentIntent sin asociar el customer obsoleto
			params.pop("customer", None)
			try:
				intent = stripe.PaymentIntent.create(**params)  # type: ignore[call-arg]
			except Exception as exc2:  # noqa: BLE001
				return jsonify({"error": f"No se pudo crear el intento de pago: {exc2}"}), 500
		else:
			return jsonify({"error": f"No se pudo crear el intento de pago: {exc}"}), 500

	return jsonify({"clientSecret": intent.client_secret, "publishableKey": STRIPE_PUBLISHABLE_KEY})


@app.post("/stripe/webhook")
def stripe_webhook():
		"""Webhook de Stripe para actualizar el plan tras un pago exitoso."""

		if stripe is None or not STRIPE_WEBHOOK_SECRET:
				return "Stripe no configurado", 500

		payload = request.data
		sig_header = request.headers.get("Stripe-Signature")
		try:
				event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
		except ValueError:
				# JSON inválido
				return "Payload inválido", 400
		except stripe.error.SignatureVerificationError:  # type: ignore[attr-defined]
				# Firma inválida
				return "Firma inválida", 400

		if event["type"] == "checkout.session.completed":
				session = event["data"]["object"]
				metadata = session.get("metadata") or {}
				email = metadata.get("email")
				plan_id = metadata.get("plan_id")
				name = metadata.get("name")
				_activate_plan_for_user(
						email=email,
						plan_id=plan_id,
						name=name,
						payment_event_id=str(event.get("id") or "") or None,
				)
		elif event["type"] == "payment_intent.succeeded":
				payment_intent = event["data"]["object"]
				metadata = payment_intent.get("metadata") or {}
				email = metadata.get("email")
				plan_id = metadata.get("plan_id")
				name = metadata.get("name")
				_activate_plan_for_user(
						email=email,
						plan_id=plan_id,
						name=name,
						payment_event_id=str(event.get("id") or "") or None,
				)

		return "OK", 200


@app.get("/pago-exitoso")
def pago_exitoso():
		"""Página simple de confirmación tras volver de Stripe."""

		return render_template_string(
				"""<!doctype html>
<html lang=\"es\">
<head>
	<meta charset=\"utf-8\">
	<title>Pago exitoso</title>
	<style>
		body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#020617; color:#e5e7eb; display:flex; align-items:center; justify-content:center; min-height:100vh; }
		.box { background:#020617; border-radius:16px; padding:24px 28px; box-shadow:0 20px 45px rgba(15,23,42,0.6); max-width:420px; text-align:center; border:1px solid #1f2937; }
		.box h1 { font-size:1.4rem; margin-bottom:0.75rem; }
		.box p { font-size:0.95rem; color:#9ca3af; margin-bottom:1.25rem; }
		.box a { display:inline-block; padding:8px 16px; border-radius:999px; background:#22c55e; color:#022c22; text-decoration:none; font-weight:600; font-size:0.95rem; }
		.box a:hover { background:#16a34a; }
	</style>
</head>
<body>
	<div class=\"box\">
		<h1>✅ Pago realizado correctamente</h1>
		<p>Tu plan se ha activado o se activará en unos segundos. Puedes volver a la app y seguir usando tus horarios.</p>
		<a href=\"/\">Volver al simulador de horario</a>
	</div>
</body>
</html>
""",
		)


@app.get("/pago-cancelado")
def pago_cancelado():
		"""Página simple cuando el usuario cancela el pago en Stripe."""

		return render_template_string(
				"""<!doctype html>
<html lang=\"es\">
<head>
	<meta charset=\"utf-8\">
	<title>Pago cancelado</title>
	<style>
		body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#020617; color:#e5e7eb; display:flex; align-items:center; justify-content:center; min-height:100vh; }
		.box { background:#020617; border-radius:16px; padding:24px 28px; box-shadow:0 20px 45px rgba(15,23,42,0.6); max-width:420px; text-align:center; border:1px solid #1f2937; }
		.box h1 { font-size:1.4rem; margin-bottom:0.75rem; }
		.box p { font-size:0.95rem; color:#9ca3af; margin-bottom:1.25rem; }
		.box a { display:inline-block; padding:8px 16px; border-radius:999px; background:#3b82f6; color:#e5f0ff; text-decoration:none; font-weight:600; font-size:0.95rem; }
		.box a:hover { background:#2563eb; }
	</style>
</head>
<body>
	<div class=\"box\">
		<h1>Pago cancelado</h1>
		<p>No se realizó ningún cargo. Puedes volver al simulador y, si lo deseas, intentar el pago nuevamente.</p>
		<a href=\"/\">Volver al simulador de horario</a>
	</div>
</body>
</html>
""",
		)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5500))
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug_mode, use_reloader=debug_mode)

