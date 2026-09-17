import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Thailand / Bangkok Timezone (UTC+7)
BANGKOK_TZ = timezone(timedelta(hours=7))

def get_bangkok_now() -> datetime:
    return datetime.now(BANGKOK_TZ)

def get_bangkok_now_str() -> str:
    return datetime.now(BANGKOK_TZ).strftime("%Y-%m-%d %H:%M:%S")

app = FastAPI(
    title="CheckNgan Attendance API",
    description="API for Authentication and GPS Geofencing Check-in / Check-out at เช็คอิน",
    version="2.2.0"
)

# Enable CORS for Mobile App and Web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Target Location: เช็คอิน (70 Soi Udom Kiat, Huai Khwang, Bangkok)
TARGET_NAME = "เช็คอิน"
TARGET_LAT = 13.7882
TARGET_LNG = 100.5803
ALLOWED_RADIUS_METERS = 100.0  # 100m geofence

# In-memory store for attendance logs
ATTENDANCE_LOGS: List[dict] = []

# Mock User Database
MOCK_USERS = {
    "supervisor": {
        "user_id": "SUP-001",
        "username": "supervisor",
        "password": "password123",
        "name": "วิชาญ ชำนาญการ (Supervisor)",
        "role": "Supervisor"
    },
    "admin": {
        "user_id": "EMP-001",
        "username": "admin",
        "password": "password123",
        "name": "ผู้จัดการร้าน (Manager)",
        "role": "Manager"
    },
    "staff1": {
        "user_id": "EMP-002",
        "username": "staff1",
        "password": "password123",
        "name": "สมชาย ใจบริการ",
        "role": "Service Staff"
    },
    "chef1": {
        "user_id": "EMP-003",
        "username": "chef1",
        "password": "password123",
        "name": "สมศรี ฝีมือดี (ครัว)",
        "role": "Head Chef"
    }
}


# --- Models ---
class LoginRequest(BaseModel):
    username: str = Field(..., example="staff1")
    password: str = Field(..., example="password123")


class UserProfile(BaseModel):
    user_id: str
    username: str
    name: str
    role: str


class LoginResponse(BaseModel):
    status: str = "success"
    message: str
    token: str
    user: UserProfile


class CheckInRequest(BaseModel):
    user_id: str = Field(..., example="EMP-002")
    user_name: Optional[str] = Field(None, example="สมชาย ใจบริการ")
    lat: float = Field(..., example=13.78821)
    lng: float = Field(..., example=100.58031)


class CheckInSuccessResponse(BaseModel):
    status: str = "success"
    message: str
    user_id: str
    user_name: Optional[str]
    distance_meters: float
    checkin_time: str
    target_location: dict


class CheckOutRequest(BaseModel):
    user_id: str = Field(..., example="EMP-002")
    user_name: Optional[str] = Field(None, example="สมชาย ใจบริการ")
    lat: float = Field(..., example=13.78821)
    lng: float = Field(..., example=100.58031)


class CheckOutSuccessResponse(BaseModel):
    status: str = "success"
    message: str
    user_id: str
    user_name: Optional[str]
    distance_meters: float
    checkout_time: str
    duration_minutes: float
    target_location: dict


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters using Haversine formula."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)


@app.get("/")
def health_check():
    return {
        "service": "CheckNgan Attendance API",
        "status": "online",
        "target_location": {
            "name": TARGET_NAME,
            "lat": TARGET_LAT,
            "lng": TARGET_LNG,
            "allowed_radius_meters": ALLOWED_RADIUS_METERS
        }
    }


# --- Authentication Endpoint ---
@app.post("/api/login", response_model=LoginResponse, summary="เข้าสู่ระบบพนักงาน")
async def login(payload: LoginRequest):
    user = MOCK_USERS.get(payload.username.strip().lower())
    if not user or user["password"] != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Invalid username or password)"
        )

    token = f"token-{user['user_id']}-{int(get_bangkok_now().timestamp())}"

    return LoginResponse(
        status="success",
        message="เข้าสู่ระบบสำเร็จ",
        token=token,
        user=UserProfile(
            user_id=user["user_id"],
            username=user["username"],
            name=user["name"],
            role=user["role"]
        )
    )


# --- Check-in Endpoint ---
@app.post(
    "/api/checkin",
    response_model=CheckInSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="GPS Check-in at Location"
)
async def check_in(payload: CheckInRequest):
    distance = calculate_haversine_distance(
        lat1=payload.lat,
        lon1=payload.lng,
        lat2=TARGET_LAT,
        lon2=TARGET_LNG
    )

    current_time_str = get_bangkok_now_str()

    if distance <= ALLOWED_RADIUS_METERS:
        # Save attendance log
        log_entry = {
            "id": len(ATTENDANCE_LOGS) + 1,
            "user_id": payload.user_id,
            "user_name": payload.user_name,
            "checkin_time": current_time_str,
            "checkout_time": None,
            "duration_minutes": None,
            "status": "CHECKED_IN",
            "checkin_distance": distance,
            "checkout_distance": None
        }
        ATTENDANCE_LOGS.append(log_entry)

        return CheckInSuccessResponse(
            status="success",
            message=f"ลงเวลาเข้างานสำเร็จ ณ {TARGET_NAME}",
            user_id=payload.user_id,
            user_name=payload.user_name,
            distance_meters=distance,
            checkin_time=current_time_str,
            target_location={
                "name": TARGET_NAME,
                "lat": TARGET_LAT,
                "lng": TARGET_LNG
            }
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "failed",
                "message": f"อยู่นอกพื้นที่ {TARGET_NAME}",
                "distance_meters": distance,
                "allowed_radius_meters": ALLOWED_RADIUS_METERS,
                "timestamp": current_time_str,
                "target_name": TARGET_NAME
            }
        )


# --- Check-out Endpoint (Must be at the location) ---
@app.post(
    "/api/checkout",
    response_model=CheckOutSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="GPS Check-out at Location (ลงเวลาออกงาน)"
)
async def check_out(payload: CheckOutRequest):
    distance = calculate_haversine_distance(
        lat1=payload.lat,
        lon1=payload.lng,
        lat2=TARGET_LAT,
        lon2=TARGET_LNG
    )

    current_time = get_bangkok_now()
    current_time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")

    # Constraint: Must be at target location to checkout!
    if distance > ALLOWED_RADIUS_METERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "failed",
                "message": f"ไม่อนุญาตให้ลงเวลาออกงาน! คุณต้องอยู่ที่ {TARGET_NAME} (ระยะห่างปัจจุบัน {distance} ม. เกินกว่า {ALLOWED_RADIUS_METERS} ม.)",
                "distance_meters": distance,
                "allowed_radius_meters": ALLOWED_RADIUS_METERS,
                "timestamp": current_time_str,
                "target_name": TARGET_NAME
            }
        )

    # Find the user's latest active checkin
    active_log = None
    for log in reversed(ATTENDANCE_LOGS):
        if log["user_id"] == payload.user_id and log["status"] == "CHECKED_IN":
            active_log = log
            break

    duration_minutes = 0.0
    if active_log:
        active_log["checkout_time"] = current_time_str
        active_log["checkout_distance"] = distance
        active_log["status"] = "COMPLETED"
        try:
            cin = datetime.strptime(active_log["checkin_time"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=BANGKOK_TZ)
            diff = (current_time - cin).total_seconds() / 60.0
            duration_minutes = max(0.0, round(diff, 1))
            active_log["duration_minutes"] = duration_minutes
        except Exception:
            duration_minutes = 0.0
    else:
        log_entry = {
            "id": len(ATTENDANCE_LOGS) + 1,
            "user_id": payload.user_id,
            "user_name": payload.user_name,
            "checkin_time": current_time_str,
            "checkout_time": current_time_str,
            "duration_minutes": 0.0,
            "status": "COMPLETED",
            "checkin_distance": distance,
            "checkout_distance": distance
        }
        ATTENDANCE_LOGS.append(log_entry)

    return CheckOutSuccessResponse(
        status="success",
        message=f"ลงเวลาออกงานสำเร็จ ณ {TARGET_NAME}",
        user_id=payload.user_id,
        user_name=payload.user_name,
        distance_meters=distance,
        checkout_time=current_time_str,
        duration_minutes=duration_minutes,
        target_location={
            "name": TARGET_NAME,
            "lat": TARGET_LAT,
            "lng": TARGET_LNG
        }
    )


# --- Get User Attendance Logs ---
@app.get("/api/logs/{user_id}", summary="ดึงประวัติการลงเวลาของพนักงาน")
async def get_user_logs(user_id: str):
    user_logs = [log for log in reversed(ATTENDANCE_LOGS) if log["user_id"] == user_id]
    active_entry = next((log for log in ATTENDANCE_LOGS if log["user_id"] == user_id and log["status"] == "CHECKED_IN"), None)
    return {
        "status": "success",
        "user_id": user_id,
        "is_checked_in": active_entry is not None,
        "active_checkin": active_entry,
        "total_records": len(user_logs),
        "logs": user_logs
    }


# --- Supervisor All Logs Endpoint ---
@app.get("/api/supervisor/logs", summary="ดึงประวัติการลงเวลาของพนักงานทุกคน (เฉพาะ Supervisor/Manager)")
async def get_supervisor_all_logs(
    role: Optional[str] = None,
    user_id: Optional[str] = None,
    date: Optional[str] = None,
    month: Optional[str] = None
):
    # Check if caller is supervisor or manager
    is_supervisor = False
    if role in ["Supervisor", "Manager"]:
        is_supervisor = True
    elif user_id:
        for u in MOCK_USERS.values():
            if u["user_id"] == user_id and u["role"] in ["Supervisor", "Manager"]:
                is_supervisor = True
                break

    if not is_supervisor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="สิทธิ์ไม่ถูกต้อง! หน้านี้สำหรับหัวหน้างาน (Supervisor/Manager) เท่านั้น"
        )

    all_logs = list(reversed(ATTENDANCE_LOGS))

    # Filter by date (YYYY-MM-DD) or month (YYYY-MM) if specified
    if date:
        all_logs = [log for log in all_logs if log.get("checkin_time", "").startswith(date)]
    elif month:
        all_logs = [log for log in all_logs if log.get("checkin_time", "").startswith(month)]

    active_count = sum(1 for log in ATTENDANCE_LOGS if log["status"] == "CHECKED_IN")

    return {
        "status": "success",
        "total_records": len(all_logs),
        "active_working_count": active_count,
        "selected_date": date,
        "selected_month": month,
        "logs": all_logs
    }

