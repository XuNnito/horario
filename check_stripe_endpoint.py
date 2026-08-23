import json
import urllib.request

req = urllib.request.Request(
    'http://127.0.0.1:5500/api/payment/create-intent',
    data=json.dumps({'plan_id': 'Plan_xunu'}).encode(),
    headers={'Content-Type': 'application/json'},
)
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        print(r.status)
        print(r.read().decode())
except Exception as e:
    print(type(e).__name__, e)
