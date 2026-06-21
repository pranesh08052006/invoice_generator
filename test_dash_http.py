import requests

def run():
    r = requests.post("http://localhost:8000/auth/login", data={"username": "sadmin1@system.com", "password": "sadmin@123"})
    token = r.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get("http://localhost:8000/dashboard/stats", headers=headers)
    print("sadmin1@system.com:", r.status_code)

    r = requests.post("http://localhost:8000/auth/login", data={"username": "admin1@gmail.com", "password": "sadmin@123"})
    token = r.json().get("access_token")
    if token:
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get("http://localhost:8000/dashboard/stats", headers=headers)
        print("admin1@gmail.com:", r.status_code, r.text)

    r = requests.post("http://localhost:8000/auth/login", data={"username": "user1@gmail.com", "password": "user1234"})
    token = r.json().get("access_token")
    if token:
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get("http://localhost:8000/dashboard/stats", headers=headers)
        print("user1@gmail.com:", r.status_code, r.text)

run()
