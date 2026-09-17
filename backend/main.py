import math
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Nilubon Kitchen & Cafe Attendance API",
    description="API for Authentication and GPS Geofencing Check-in at Nilubon Kitchen & Cafe",
    version="2.0.0"
)

# Enable CORS for Mobile App and Web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Target Location: Nilubon Kitchen & Cafe (70 Soi Udom Kiat, Huai Khwang, Bangkok)
TARGET_NAME = "Nilubon Kitchen & Cafe"
TARGET_LAT = 13.7882
TARGET_LNG = 100.5803
ALLOWED_RADIUS_METERS = 100.0  # 100m geofence

# Mock User Database
MOCK_USERS = {
    "admin": {
        "user_id": "EMP-001",
        "username": "admin",
        "password": "password123",
        "name": "ผู้จัดการร้าน",
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
        "service": "Nilubon Kitchen & Cafe Attendance API",
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

    # In production, sign a JWT token. For demo, return mock auth token.
    token = f"token-{user['user_id']}-{datetime.now().timestamp()}"

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
    summary="GPS Check-in at Nilubon Kitchen & Cafe"
)
async def check_in(payload: CheckInRequest):
    distance = calculate_haversine_distance(
        lat1=payload.lat,
        lon1=payload.lng,
        lat2=TARGET_LAT,
        lon2=TARGET_LNG
    )

    current_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if distance <= ALLOWED_RADIUS_METERS:
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
                "message": f"อยู่นอกพื้นที่ร้าน {TARGET_NAME}",
                "distance_meters": distance,
                "allowed_radius_meters": ALLOWED_RADIUS_METERS,
                "timestamp": current_time_str,
                "target_name": TARGET_NAME
            }
        )
