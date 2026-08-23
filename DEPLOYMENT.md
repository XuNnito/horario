# Despliegue en Vercel

La aplicación usa SQLite solamente en desarrollo local. En Vercel requiere una
base PostgreSQL persistente y toma la conexión desde `DATABASE_URL` (o
`POSTGRES_URL`).

## Variables de entorno

Configura en Vercel, como mínimo:

- `DATABASE_URL`: conexión PostgreSQL con SSL de Neon, Vercel Postgres u otro proveedor.
- `SESSION_SECRET`: cadena aleatoria larga para firmar sesiones.
- `ADMIN_TOKEN`: token aleatorio largo para proteger el panel administrativo.
- `STRIPE_SECRET_KEY`: clave secreta de producción (`sk_live_...`).
- `STRIPE_PUBLISHABLE_KEY`: clave publicable de producción (`pk_live_...`).
- `STRIPE_WEBHOOK_SECRET`: secreto del endpoint de producción (`whsec_...`).
- `STRIPE_PRICE_Plan_xunu`: se conserva para el flujo alternativo de Stripe Checkout.
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: credenciales del acceso con Google.

No copies claves reales al repositorio.

Antes de publicar, ejecuta `npm ci` y `npm run build`. El HTML de producción
carga los archivos ofuscados de `dist/js`; `src/js` se conserva como código
fuente mantenible. La ofuscación dificulta la lectura del frontend, pero los
secretos y las decisiones de autorización deben permanecer siempre en el
servidor.

## Migrar los datos anteriores

Conserva una copia de `security_logs.db`, instala `requirements.txt`, define
`DATABASE_URL` en PowerShell y ejecuta:

```powershell
$env:DATABASE_URL='postgresql://usuario:clave@host/base?sslmode=require'
python migrate_sqlite_to_postgres.py
```

La migración no sobrescribe registros que ya existan en PostgreSQL, por lo que se
puede volver a ejecutar sin duplicar usuarios ni visitas.

## Webhook de Stripe

Crea en Stripe un webhook HTTPS apuntando a:

```text
https://TU-DOMINIO/stripe/webhook
```

Suscribe al menos el evento `payment_intent.succeeded` y copia su secreto a
`STRIPE_WEBHOOK_SECRET`. El plan se activa solamente después de que este webhook
firmado confirme el pago.

Las claves de prueba y las de producción pertenecen a entornos distintos. Al
cambiar a producción, usa conjuntamente `sk_live_...`, `pk_live_...`, el webhook
creado en modo live y, si se usa Checkout, un `price_...` creado en modo live.
