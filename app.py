from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta

from flask import (
		Flask,
		abort,
		jsonify,
		redirect,
		render_template_string,
		request,
)
from urllib.parse import urlsplit


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "security_logs.db")

# Configuración de Stripe (claves y planes)
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

# Planes disponibles en la app (ids lógicos internos)
# En este proyecto usamos un único plan de pago basado en usos:
#   Plan_xunu -> 49 MXN, sin fecha de expiración (se limita por número de usos).
PLAN_DURATIONS_DAYS = {
		"Plan_xunu": None,
}

# Ids de precios de Stripe (rellenar con tu price_xxx real)
# "Plan_xunu" será el plan de 49 MXN, sin renovación automática.
STRIPE_PRICE_IDS = {
		"Plan_xunu": os.environ.get("STRIPE_PRICE_Plan_xunu"),
}

try:
		import stripe  # type: ignore[import]

		if STRIPE_SECRET_KEY:
				stripe.api_key = STRIPE_SECRET_KEY
except ImportError:  # Stripe no instalado aún
		stripe = None  # type: ignore[assignment]


def get_db_connection() -> sqlite3.Connection:
		conn = sqlite3.connect(DB_PATH)
		conn.row_factory = sqlite3.Row
		return conn


def init_db() -> None:
		conn = get_db_connection()
		cur = conn.cursor()

		# Tabla de visitas (tanto anónimas como con sesión)
		cur.execute(
				"""
				CREATE TABLE IF NOT EXISTS visits (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
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
				cur.execute("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'")
		except sqlite3.OperationalError:
				# Ya existe la columna
				pass

		try:
				cur.execute("ALTER TABLE users ADD COLUMN plan_expires_at TEXT")  # epoch en segundos o NULL
		except sqlite3.OperationalError:
				# Ya existe la columna
				pass

		# Columnas para contar usos (límites del plan gratuito)
		try:
				cur.execute(
						"ALTER TABLE users ADD COLUMN catalog_created_count INTEGER NOT NULL DEFAULT 0",
				)
		except sqlite3.OperationalError:
				pass

		try:
				cur.execute(
						"ALTER TABLE users ADD COLUMN print_count INTEGER NOT NULL DEFAULT 0",
				)
		except sqlite3.OperationalError:
				pass

		try:
				cur.execute(
						"ALTER TABLE users ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0",
				)
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

		conn.commit()
		conn.close()


app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")

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
				# Fallback razonable si no está configurada la variable de entorno.
				# Incluye GitHub Pages y desarrollo local típico.
				allowed_origins = [
						"https://xunnito.github.io",
						"http://127.0.0.1:5500",
						"http://localhost:5500",
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
		return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _now_ts() -> int:
		"""Devuelve timestamp UTC en segundos (entero)."""
		return int(datetime.utcnow().timestamp())


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


def _get_ip() -> str | None:
		# Respeta cabecera X-Forwarded-For si estás detrás de un proxy/reverso
		fwd = request.headers.get("X-Forwarded-For")
		if fwd:
				return fwd.split(",")[0].strip()
		return request.remote_addr


def _upsert_user(name: str | None, email: str | None) -> None:
		if not email:
				return
		conn = get_db_connection()
		cur = conn.cursor()
		now = _now_iso()

		cur.execute("SELECT email FROM users WHERE email = ?", (email,))
		row = cur.fetchone()
		if row:
				cur.execute(
						"UPDATE users SET name = COALESCE(?, name), last_seen = ? WHERE email = ?",
						(name, now, email),
				)
		else:
				cur.execute(
						"INSERT INTO users (email, name, first_seen, last_seen, status) VALUES (?, ?, ?, ?, 'active')",
						(email, name, now, now),
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
			"INSERT OR REPLACE INTO stripe_customers (email, customer_id) VALUES (?, ?)",
			(email, str(customer_id)),
	)
	conn.commit()
	conn.close()
	return str(customer_id)


def _activate_plan_for_user(email: str | None, plan_id: str | None, name: str | None = None) -> None:
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
		# Al activar un plan de pago, reiniciamos los contadores de uso para que
		# el usuario vuelva a tener el paquete completo de usos (no se acumulan).
		cur.execute(
				"""
				UPDATE users
				SET plan = ?,
						plan_expires_at = ?,
						catalog_created_count = 0,
						print_count = 0,
						download_count = 0
				WHERE email = ?
				""",
				(plan_id, expires_ts, email),
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
				except (TypeError, ValueError):
						expires_ts = None

		effective = stored_plan
		# Cualquier plan de pago con fecha de expiración vencida vuelve a "free".
		if effective != "free" and expires_ts is not None and expires_ts < now_ts:
				effective = "free"

		return effective, stored_plan, expires_ts


@app.route("/")
def index():
		"""Sirve la página principal y registra una visita anónima."""
		_insert_visit(event_type="page_view", name=None, email=None, path=request.path)
		# Envía el archivo index.html existente
		return app.send_static_file("index.html")


@app.get("/panel")
def panel_control():
	"""Página de panel con menú para historial, usuarios y vistas.

	Se sirve como un HTML estático (panel.html) en la raíz del proyecto.
	"""

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
	- Plan free: usa ``free_limit`` pasado por parámetro.
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
		token_req = request.args.get("token")
		expected = os.environ.get("ADMIN_TOKEN", "xunito")
		if token_req != expected:
				# 401 simple. Puedes cambiarlo a una plantilla bonita si quieres.
				return abort(401)


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
	<form method="post" action="/historial/clear{% if token_param %}?token={{ token_param }}{% endif %}" style="margin-bottom:1rem;" onsubmit="return confirm('Esto borrará TODO el historial de visitas (incluye logins y vistas anónimas). ¿Quieres continuar?');">
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
			token_param=request.args.get("token") or "",
		)
		return html


@app.post("/historial/clear")
def historial_clear():
		"""Borra todos los registros de la tabla visits (historial completo).

		Protegido con ADMIN_TOKEN mediante _require_admin.
		"""

		_require_admin()
		conn = get_db_connection()
		cur = conn.cursor()
		cur.execute("DELETE FROM visits")
		conn.commit()
		conn.close()

		# Mantener el mismo token en la redirección, si existe
		token_req = request.args.get("token") or ""
		if token_req:
				return redirect(f"/historial?token={token_req}")
		return redirect("/historial")


@app.get("/usuarios")
def usuarios():
		"""Listado de usuarios que han iniciado sesión y su estado."""

		# Opcional: proteger con token
		# _require_admin()

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
						<input type="hidden" name="email" value="{{ u['email'] }}">
						<input type="hidden" name="status" value="active">
						<button type="submit" class="btn-activate">Activar</button>
					</form>
					<form method="post" action="/usuarios/estado">
						<input type="hidden" name="email" value="{{ u['email'] }}">
						<input type="hidden" name="status" value="suspended">
						<button type="submit" class="btn-suspend">Suspender</button>
					</form>
					<form method="post" action="/usuarios/estado" onsubmit="return confirm('¿Marcar como eliminada esta cuenta?');">
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
		)
		return html


@app.get("/login_resumen")
def login_resumen():
		"""Resumen: una fila por cuenta con cuántas veces inició sesión."""

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

		# Opcional: proteger con token
		# _require_admin()

		email = request.form.get("email")
		status = request.form.get("status")

		if not email or status not in {"active", "suspended", "deleted"}:
				return redirect("/usuarios")

		conn = get_db_connection()
		cur = conn.cursor()
		if status == "deleted":
				# Eliminación total: borrar visitas y el registro del usuario
				cur.execute("DELETE FROM visits WHERE email = ?", (email,))
				cur.execute("DELETE FROM users WHERE email = ?", (email,))
		else:
				# Suspender o activar solo cambia el estado en la tabla de usuarios
				cur.execute("UPDATE users SET status = ? WHERE email = ?", (status, email))
		conn.commit()
		conn.close()

		return redirect("/usuarios")


@app.post("/api/usage/catalog-create")
def api_usage_catalog_create():
		"""Registra la creación de una materia de catálogo.

		Plan gratuito: máximo 2 creaciones (aunque luego se eliminen).
		"""

		data = request.get_json(silent=True) or {}
		email = str(data.get("email") or "").strip()
		if not email:
				return jsonify({"allowed": False, "reason": "missing_email"}), 400

		allowed, payload = _increment_usage_counter(email, "catalog_created_count", free_limit=2)
		status_code = 200 if allowed else 403
		return jsonify(payload), status_code


@app.post("/api/usage/print")
def api_usage_print():
		"""Registra una impresión de horario.

		Plan gratuito: solo 1 impresión.
		"""

		data = request.get_json(silent=True) or {}
		email = str(data.get("email") or "").strip()
		if not email:
				return jsonify({"allowed": False, "reason": "missing_email"}), 400

		allowed, payload = _increment_usage_counter(email, "print_count", free_limit=1)
		status_code = 200 if allowed else 403
		return jsonify(payload), status_code


@app.post("/api/usage/download")
def api_usage_download():
		"""Registra una descarga de PDF (reinscripción).

		Plan gratuito: solo 1 descarga.
		"""

		data = request.get_json(silent=True) or {}
		email = str(data.get("email") or "").strip()
		if not email:
				return jsonify({"allowed": False, "reason": "missing_email"}), 400

		allowed, payload = _increment_usage_counter(email, "download_count", free_limit=1)
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
				"catalog": 2,
				"print": 1,
				"download": 1,
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
		"""Activa un plan desde el frontend tras confirmar el pago.

		Este endpoint existe para entornos donde el webhook de Stripe no
		puede llegar (por ejemplo, desarrollo local). El frontend lo
		invoca solo cuando Stripe confirma el pago como "succeeded".
		"""

		data = request.get_json(silent=True) or {}
		email = str(data.get("email") or "").strip()
		plan_id = str(data.get("plan_id") or "").strip()
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


@app.post("/api/checkout/create-session")
def api_create_checkout_session():
		"""Crea una sesión de Stripe Checkout para comprar un plan.

		El frontend envía: {"plan_id": "basic_20"|"Plan_xunu"|"pro_50", "email": "...", "name": "..."}
		"""

		if stripe is None or not STRIPE_SECRET_KEY:
				return (
						jsonify({"error": "Stripe no está configurado en el servidor (falta instalar o definir claves)."}),
						500,
				)

		data = request.get_json(silent=True) or {}
		plan_id = str(data.get("plan_id") or "")
		email = str(data.get("email") or "").strip()
		name = str(data.get("name") or "").strip() or None

		if plan_id not in PLAN_DURATIONS_DAYS:
				return jsonify({"error": "Plan no válido."}), 400
		if not email:
				return jsonify({"error": "Es necesario un correo para asociar el plan."}), 400

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

	if stripe is None or not STRIPE_SECRET_KEY:
		return (
				jsonify({"error": "Stripe no está configurado en el servidor (falta instalar o definir claves)."}),
				500,
		)

	data = request.get_json(silent=True) or {}
	plan_id = str(data.get("plan_id") or "")
	email = str(data.get("email") or "").strip()
	name = str(data.get("name") or "").strip() or None

	if plan_id not in PLAN_DURATIONS_DAYS:
		return jsonify({"error": "Plan no válido."}), 400
	if not email:
		return jsonify({"error": "Es necesario un correo para asociar el plan."}), 400

	# Monto fijo para el plan Plan_xunu: 49 MXN
	amount = 4900  # en centavos de MXN

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
			"description": "Plan Horarios Bio 49 MXN (10 usos)",
			# Habilita métodos automáticos (tarjeta y otros compatibles en MX)
			"automatic_payment_methods": {"enabled": True},
	}
	# Si tenemos un customer, lo asociamos y pedimos guardar la forma de pago
	if customer_id:
		params["customer"] = customer_id
		params["setup_future_usage"] = "off_session"

	try:
		intent = stripe.PaymentIntent.create(**params)  # type: ignore[call-arg]
	except Exception as exc:  # noqa: BLE001
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
				_activate_plan_for_user(email=email, plan_id=plan_id, name=name)
		elif event["type"] == "payment_intent.succeeded":
				payment_intent = event["data"]["object"]
				metadata = payment_intent.get("metadata") or {}
				email = metadata.get("email")
				plan_id = metadata.get("plan_id")
				name = metadata.get("name")
				_activate_plan_for_user(email=email, plan_id=plan_id, name=name)

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
    app.run(host="0.0.0.0", port=port, debug=True)

