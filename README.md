# Mobile Attendance Check-in with GPS Geofencing

ระบบลงเวลาเข้างานผ่านพิกัด GPS พร้อมตรวจสอบ Geofencing แบบ Full-Stack ทำงานร่วมกันระหว่าง **Ionic (Angular)**, **Python (FastAPI)** และ **Docker Compose**

---

## 🏗 โครงสร้างโปรเจกต์ (Project Structure)

```text
d:\PP\POC-AI/
├── backend/
│   ├── main.py              # FastAPI server, Haversine formula, /api/checkin
│   ├── requirements.txt     # Python dependencies (fastapi, uvicorn, pydantic)
│   ├── Dockerfile           # Python 3.11-slim container
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── home/        # Check-in Screen (UI, Geolocation & Toast logic)
│   │   │   ├── app.component.ts / html
│   │   │   └── app.routes.ts
│   │   ├── theme/
│   │   ├── global.scss
│   │   ├── index.html
│   │   └── main.ts
│   ├── angular.json
│   ├── tsconfig.json
│   ├── package.json
│   ├── nginx.conf           # SPA Routing & Caching
│   ├── Dockerfile           # Multi-stage build (Node.js -> Nginx)
│   └── .dockerignore
├── docker-compose.yml       # รัน Backend (:8000) และ Frontend (:80) พร้อมกัน
└── README.md
```

---

## 🚀 คำสั่งเริ่มต้นใช้งาน (Getting Started)

### วิธีที่ 1: รันด้วย Docker Compose (แนะนำ)

เปิด Terminal ที่โฟลเดอร์นี้ แล้วรันคำสั่ง:

```bash
docker compose up --build
```

เมื่อระบบเริ่มทำงานเรียบร้อย:
- **Frontend App**: เข้าใช้งานได้ที่ [http://localhost:8080](http://localhost:8080)
- **Backend API & Swagger Docs**: เข้าใช้งานได้ที่ [http://localhost:8000/docs](http://localhost:8000/docs)

---

### วิธีที่ 2: รันแบบแยกเครื่อง Local (Without Docker)

#### รัน Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### รัน Frontend:
```bash
cd frontend
npm install
npm run start
```
Frontend จะเปิดที่ [http://localhost:4200](http://localhost:4200)

---

## 📍 พิกัดเป้าหมาย (Geofencing Configuration)

- **สถานที่เป้าหมาย**: ไซต์งานก่อสร้าง อุดรธานี
- **Latitude**: `17.4138`
- **Longitude**: `102.7872`
- **รัศมีอนุญาต**: `100.0` เมตร

### ตัวอย่างการทดสอบผ่าน cURL หรือ Postman

#### 1. ทดสอบกรณีอยู่ในพื้นที่ (HTTP 200 OK)
```bash
curl -X POST http://localhost:8000/api/checkin \
  -H "Content-Type: application/json" \
  -d '{"user_id": "EMP-001", "lat": 17.41382, "lng": 102.78722}'
```
**Response (200):**
```json
{
  "status": "success",
  "message": "ลงเวลาเข้างานสำเร็จ (Check-in Successful)",
  "user_id": "EMP-001",
  "distance_meters": 3.01,
  "checkin_time": "2026-09-10 14:00:00",
  "target_location": {
    "lat": 17.4138,
    "lng": 102.7872
  }
}
```

#### 2. ทดสอบกรณีอยู่นอกพื้นที่ (HTTP 400 Bad Request)
```bash
curl -X POST http://localhost:8000/api/checkin \
  -H "Content-Type: application/json" \
  -d '{"user_id": "EMP-001", "lat": 13.7563, "lng": 100.5018}'
```
**Response (400):**
```json
{
  "detail": {
    "status": "failed",
    "message": "อยู่นอกพื้นที่ทำงาน (Outside of Work Site)",
    "distance_meters": 472138.45,
    "allowed_radius_meters": 100.0,
    "timestamp": "2026-09-10 14:00:00"
  }
}
```

---

## 📱 ข้อแนะนำสำหรับการทดสอบด้วย Mobile Device / Emulator

1. **Chrome DevTools Sensors Mocking**:
   - กด `F12` ใน Google Chrome -> เมนูสามจุด -> **More tools** -> **Sensors**
   - ในหัวข้อ **Location** เลือก **Custom location...** แล้วใส่:
     - Latitude: `17.4138`
     - Longitude: `102.7872`
   - กดปุ่ม **Check-in** จะเห็นการแจ้งเตือนว่าลงเวลาสำเร็จทันที
2. **ทดสอบบน Android Emulator**:
   - หากรันบน Native Android Emulator ให้เปลี่ยน Base URL ใน `home.page.ts` จาก `http://localhost:8000` เป็น `http://10.0.2.2:8000`
