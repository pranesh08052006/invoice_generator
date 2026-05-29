import urllib.request
import urllib.parse
import urllib.error
import json

def test():
    try:
        data = urllib.parse.urlencode({'username':'sadmin1@system.com', 'password':'sadmin@123'}).encode()
        req = urllib.request.Request('http://localhost:8000/auth/login', data=data)
        res = json.loads(urllib.request.urlopen(req).read())
        token = res['access_token']
        
        req2 = urllib.request.Request('http://localhost:8000/dashboard/stats', headers={'Authorization': 'Bearer '+token})
        print(urllib.request.urlopen(req2).read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code)
        print("Body:", e.read().decode())

test()
