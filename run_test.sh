kill -9 $(lsof -t -i:8000)
source backend/venv/bin/activate
cd backend
uvicorn main:app --reload &
UVICORN_PID=$!
sleep 3
python3 ../test_dash_http3.py > ../test_out.log 2>&1
kill $UVICORN_PID
