import requests
import json

BASE_URL = "http://localhost:8000"

# Assuming you have a way to get a token, but let's try to see if it even reaches the endpoint or fails validation
# I'll just try to send a request and see the validation error (422) if any.

payload = {
    "name": "Test",
    "address": "Test",
    "mobile": "1234567890",
    "invoice_color": "#ff0000"
}

r = requests.post(f"{BASE_URL}/company", json=payload)
print(f"Status: {r.status_code}")
print(f"Response: {r.text}")
