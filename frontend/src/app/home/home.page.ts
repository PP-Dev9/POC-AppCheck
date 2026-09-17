import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { getApiBaseUrl } from '../api.config';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonSpinner,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkboxOutline,
  logOutOutline,
  restaurantOutline,
  radioOutline,
  fingerPrintOutline,
  navigateCircleOutline,
  personCircleOutline,
  timeOutline,
  constructOutline,
} from 'ionicons/icons';
import { Geolocation, PositionOptions } from '@capacitor/geolocation';
import { firstValueFrom } from 'rxjs';
import { AuthService, UserProfile } from '../services/auth.service';

interface CheckInPayload {
  user_id: string;
  user_name?: string;
  lat: number;
  lng: number;
}

interface CheckInSuccessResponse {
  status: string;
  message: string;
  user_id: string;
  user_name?: string;
  distance_meters: number;
  checkin_time: string;
  target_location: {
    name: string;
    lat: number;
    lng: number;
  };
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonContent,
    IonCard,
    IonCardContent,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
})
export class HomePage implements OnInit {
  private get API_URL(): string {
    return `${getApiBaseUrl()}/api/checkin`;
  }

  currentUser: UserProfile | null = null;
  isLoading = false;
  loadingMessage = 'กำลังเตรียมการ...';
  lastCoords: { latitude: number; longitude: number } | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {
    addIcons({
      checkboxOutline,
      logOutOutline,
      restaurantOutline,
      radioOutline,
      fingerPrintOutline,
      navigateCircleOutline,
      personCircleOutline,
      timeOutline,
      constructOutline,
    });
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  onLogout() {
    this.authService.logout();
  }

  /**
   * Main Check-in handler triggered on button click
   */
  async onCheckIn() {
    this.isLoading = true;
    this.loadingMessage = 'กำลังดึงพิกัด GPS...';

    try {
      // 1. Fetch current GPS location via Capacitor Geolocation
      const coords = await this.getCurrentLocation();
      this.lastCoords = coords;

      this.loadingMessage = 'กำลังตรวจสอบพิกัดกับร้าน...';

      // 2. Dispatch POST request to Backend
      await this.sendCheckInRequest(coords.latitude, coords.longitude);

    } catch (error: any) {
      await this.handleCheckInError(error);
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  /**
   * Get device coordinates and handle runtime permissions
   */
  private async getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
    try {
      let permStatus = await Geolocation.checkPermissions();

      if (permStatus.location !== 'granted') {
        permStatus = await Geolocation.requestPermissions();
      }

      if (permStatus.location !== 'granted') {
        throw new Error('PERMISSION_DENIED');
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      };

      const position = await Geolocation.getCurrentPosition(options);

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (err: any) {
      if (err.message === 'User denied Geolocation' || err.code === 1) {
        throw new Error('PERMISSION_DENIED');
      }
      throw err;
    }
  }

  /**
   * Send HTTP POST request to FastAPI backend
   */
  private async sendCheckInRequest(lat: number, lng: number): Promise<void> {
    const payload: CheckInPayload = {
      user_id: this.currentUser?.user_id || 'EMP-UNKNOWN',
      user_name: this.currentUser?.name || 'พนักงาน',
      lat: lat,
      lng: lng,
    };

    try {
      const response = await firstValueFrom(
        this.http.post<CheckInSuccessResponse>(this.API_URL, payload)
      );

      // HTTP 200: Geofence passed
      await this.showToast(
        `✅ ${response.message} (ห่าง ${response.distance_meters} ม.) เวลา: ${response.checkin_time}`,
        'success',
        4500
      );
    } catch (err: any) {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 400) {
          // HTTP 400: Out of Geofence bounds
          const detail = err.error?.detail;
          const dist = detail?.distance_meters ?? 'ไม่ระบุ';
          const msg = detail?.message ?? 'อยู่นอกพื้นที่ร้าน';

          await this.showToast(
            `⚠️ ${msg} (คุณอยู่ห่าง ${dist} ม. / รัศมีอนุญาต 100 ม.)`,
            'danger',
            5000
          );
        } else if (err.status === 0) {
          await this.showToast(
            '❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ Backend (กรุณาเปิด Wi-Fi วงเดียวกับคอมพิวเตอร์)',
            'danger',
            4500
          );
        } else {
          await this.showToast(
            `❌ ข้อผิดพลาดจากเซิร์ฟเวอร์ (HTTP ${err.status})`,
            'danger',
            3500
          );
        }
      } else {
        throw err;
      }
    }
  }

  private async handleCheckInError(error: any) {
    console.error('CheckIn Error:', error);

    if (error.message === 'PERMISSION_DENIED') {
      await this.showAlert(
        'การเข้าถึงตำแหน่งถูกปฏิเสธ',
        'กรุณาอนุญาตให้แอป CheckNgan เข้าถึงตำแหน่ง GPS ในการตั้งค่าของอุปกรณ์'
      );
    } else if (error.code === 2 || error.message?.includes('Position unavailable')) {
      await this.showToast(
        '⚠️ ไม่พบสัญญาณ GPS กรุณาเปิด Location Service บนอุปกรณ์',
        'warning',
        4000
      );
    } else if (error.code === 3 || error.message?.includes('Timeout')) {
      await this.showToast(
        '⚠️ หมดเวลารอสัญญาณ GPS กรุณาลองใหม่อีกครั้ง',
        'warning',
        4000
      );
    } else if (error instanceof HttpErrorResponse) {
      // Handled in sendCheckInRequest
    } else {
      await this.showToast('⚠️ เกิดข้อผิดพลาดในการดึงพิกัด กรุณาลองใหม่', 'danger', 3500);
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning', duration = 3500) {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      position: 'top',
      color,
      buttons: [{ text: 'ปิด', role: 'cancel' }],
    });
    await toast.present();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['ตกลง'],
    });
    await alert.present();
  }
}
