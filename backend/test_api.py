import urllib.request
import urllib.parse
import urllib.error
import json

def test():
    try:
        data = urllib.parse.urlencode({'username':'admin@system.com', 'password':'admin123'}).encode()
        req = urllib.request.Request('http://3.86.4.100:8000/auth/login', data=data)
        res = json.loads(urllib.request.urlopen(req).read())
        token = res['access_token']
        
        req2 = urllib.request.Request('http://3.86.4.100:8000/dashboard/stats', headers={'Authorization': 'Bearer '+token})
        print(urllib.request.urlopen(req2).read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code)
        print("Body:", e.read().decode())

test()
