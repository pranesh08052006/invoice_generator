backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload

frontend 
npm run dev

app
adb reverse tcp:8000 tcp:8000
flutter run -d PN4TGUZTE6L7JNUK
