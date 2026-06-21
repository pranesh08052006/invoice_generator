import requests

def run():
    r = requests.post("http://localhost:8000/auth/login", data={"username": "sadmin1@system.com", "password": "sadmin@123"})
    print(r.json())
    token = r.json().get("access_token")
    if not token:
        return
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get("http://localhost:8000/dashboard/stats", headers=headers)
    print("Status:", r.status_code)
    print(r.json())

run()
