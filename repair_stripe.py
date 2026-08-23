from pathlib import Path
path = Path(r'd:\Horario\horario\app.py')
text = path.read_text(encoding='utf-8')
start = text.index('@app.post("/api/checkout/create-session")')
end = text.index('@app.post("/stripe/webhook")')
new_block = '''@app.post("/api/checkout/create-session")
def api_create_checkout_session():
		"""Crea una sesión de Stripe Checkout para comprar un plan.

		El frontend envía: {"plan_id": "basic_20"|"Plan_xunu"|"pro_50", "email": "...", "name": "..."}
		"""

		if stripe is None or not _has_valid_stripe_secret_key():
				return (
						jsonify({"error": "error contacta con el desarrollador."}),
					500,
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
			500,
		)

	data = request.get_json(silent=True) or {}
	plan_id = str(data.get("plan_id") or "")
	email = _require_app_session()
	name = str(session.get("name") or "").strip() or None

	if plan_id not in PLAN_DURATIONS_DAYS:
		return jsonify({"error": "Plan no válido."}), 400
	if not email:
		return jsonify({"error": "Debes iniciar sesión antes de comprar un plan."}), 401

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
			params.pop("setup_future_usage", None)
			try:
				intent = stripe.PaymentIntent.create(**params)  # type: ignore[call-arg]
			except Exception as exc2:  # noqa: BLE001
				return jsonify({"error": f"No se pudo crear el intento de pago: {exc2}"}), 500
		else:
			return jsonify({"error": f"No se pudo crear el intento de pago: {exc}"}), 500

	return jsonify({"clientSecret": intent.client_secret, "publishableKey": STRIPE_PUBLISHABLE_KEY})


'''
path.write_text(text[:start] + new_block + text[end:], encoding='utf-8')
print('done')
