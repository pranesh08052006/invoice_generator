import requests

def run():
    r = requests.post("http://localhost:8000/auth/login", data={"username": "user1@gmail.com", "password": "sadmin@123"})
    print(r.json())
run()
