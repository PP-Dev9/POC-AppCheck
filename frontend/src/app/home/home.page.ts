import { Component, OnInit, OnDestroy } from '@angular/core';
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
  IonSegment,
  IonSegmentButton,
  IonBadge,
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
  checkmarkCircleOutline,
  timerOutline,
  alertCircleOutline,
  listOutline,
  locateOutline,
  peopleOutline,
  refreshOutline,
  briefcaseOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { Geolocation, PositionOptions } from '@capacitor/geolocation';
import { firstValueFrom } from 'rxjs';
import { AuthService, UserProfile } from '../services/auth.service';

export interface AttendanceLog {
  id: number;
  user_id: string;
  user_name?: string;
  checkin_time: string;
  checkout_time?: string | null;
  duration_minutes?: number | null;
  status: string;
  checkin_distance?: number;
  checkout_distance?: number | null;
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
    IonSegment,
    IonSegmentButton,
    IonBadge,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  private get BASE_URL(): string {
    return getApiBaseUrl();
  }

  currentUser: UserProfile | null = null;
  isLoading = false;
  loadingMessage = 'กำลังเตรียมการ...';
  lastCoords: { latitude: number; longitude: number } | null = null;

  // Tabs
  currentTab: 'checkin' | 'supervisor' = 'checkin';
  isSupervisorUser = false;

  // My Attendance states
  isCheckedIn = false;
  checkInTime: string | null = null;
  activeLog: AttendanceLog | null = null;
  elapsedTimeString = '00:00:00';
  private timerSubscription: any = null;

  // Personal Logs
  logs: AttendanceLog[] = [];

  // Supervisor Dashboard states
  supervisorLogs: AttendanceLog[] = [];
  activeWorkingCount = 0;
  isRefreshingSupervisor = false;

  // Mock test location for testing without physical GPS device
  useMockLocation = false;
  mockMode: 'inside' | 'outside' = 'inside';

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
      checkmarkCircleOutline,
      timerOutline,
      alertCircleOutline,
      listOutline,
      locateOutline,
      peopleOutline,
      refreshOutline,
      briefcaseOutline,
      shieldCheckmarkOutline,
    });
  }

  async ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    // Determine if logged-in user is Supervisor or Manager
    const roleLower = (this.currentUser.role || '').toLowerCase();
    const userLower = (this.currentUser.username || '').toLowerCase();
    this.isSupervisorUser =
      roleLower.includes('supervisor') ||
      roleLower.includes('manager') ||
      userLower === 'supervisor' ||
      userLower === 'admin';

    // Fetch personal attendance logs
    await this.fetchUserLogs();

    // If supervisor, also fetch all employee records
    if (this.isSupervisorUser) {
      await this.fetchSupervisorLogs();
    }
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  /**
   * Switch between Check-in Tab and Supervisor Tab
   */
  onTabChange(event: any) {
    this.currentTab = event.detail.value;
    if (this.currentTab === 'supervisor') {
      this.fetchSupervisorLogs();
    }
  }

  /**
   * Fetch personal attendance logs
   */
  async fetchUserLogs() {
    if (!this.currentUser) return;
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.BASE_URL}/api/logs/${this.currentUser.user_id}`)
      );
      if (res && res.status === 'success') {
        this.logs = res.logs || [];
        this.isCheckedIn = res.is_checked_in;
        this.activeLog = res.active_checkin;

        if (this.isCheckedIn && this.activeLog) {
          this.checkInTime = this.activeLog.checkin_time;
          this.startTimer(new Date(this.checkInTime.replace(' ', 'T')));
        } else {
          this.stopTimer();
        }
      }
    } catch (err) {
      console.warn('Could not fetch user logs:', err);
    }
  }

  /**
   * Fetch all staff logs for supervisor view
   */
  async fetchSupervisorLogs() {
    if (!this.isSupervisorUser || !this.currentUser) return;
    this.isRefreshingSupervisor = true;
    try {
      const res: any = await firstValueFrom(
        this.http.get(
          `${this.BASE_URL}/api/supervisor/logs?role=${this.currentUser.role}&user_id=${this.currentUser.user_id}`
        )
      );
      if (res && res.status === 'success') {
        this.supervisorLogs = res.logs || [];
        this.activeWorkingCount = res.active_working_count || 0;
      }
    } catch (err) {
      console.warn('Could not fetch supervisor logs:', err);
    } finally {
      this.isRefreshingSupervisor = false;
    }
  }

  /**
   * Start live duration timer
   */
  private startTimer(startTime: Date) {
    this.stopTimer();
    const update = () => {
      const now = new Date();
      const diffMs = Math.max(0, now.getTime() - startTime.getTime());
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      this.elapsedTimeString = `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`;
    };
    update();
    this.timerSubscription = setInterval(update, 1000);
  }

  private stopTimer() {
    if (this.timerSubscription) {
      clearInterval(this.timerSubscription);
      this.timerSubscription = null;
    }
    this.elapsedTimeString = '00:00:00';
  }

  private pad(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }

  /**
   * Format minutes to human readable Thai string (e.g. 2 ชม. 30 นาที)
   */
  formatDuration(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) return '-';
    if (minutes < 1) return 'น้อยกว่า 1 นาที';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs === 0) return `${mins} นาที`;
    if (mins === 0) return `${hrs} ชม.`;
    return `${hrs} ชม. ${mins} นาที`;
  }

  /**
   * Main Check-in handler
   */
  async onCheckIn() {
    this.isLoading = true;
    this.loadingMessage = 'กำลังดึงพิกัด GPS...';

    try {
      const coords = await this.getCurrentLocation();
      this.lastCoords = coords;

      this.loadingMessage = 'กำลังตรวจสอบพิกัดกับร้าน...';

      const payload = {
        user_id: this.currentUser?.user_id,
        user_name: this.currentUser?.name,
        lat: coords.latitude,
        lng: coords.longitude,
      };

      const res: any = await firstValueFrom(
        this.http.post(`${this.BASE_URL}/api/checkin`, payload)
      );

      this.isCheckedIn = true;
      this.checkInTime = res.checkin_time;
      this.startTimer(new Date());

      await this.showToast(
        `✅ ลงเวลาเข้างานสำเร็จ! ระยะห่าง ${res.distance_meters} ม.`,
        'success',
        4000
      );

      await this.fetchUserLogs();
      if (this.isSupervisorUser) {
        await this.fetchSupervisorLogs();
      }
    } catch (error: any) {
      await this.handleLocationError(error, 'เข้างาน');
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  /**
   * Main Check-out / Logout handler
   * Requirement: ตอน logout ต้องมา logout ที่เดิม
   */
  async onCheckOutOrLogout() {
    if (!this.isCheckedIn) {
      const alert = await this.alertCtrl.create({
        header: 'ยืนยันออกจากระบบ',
        message: 'คุณยังไม่ได้ลงเวลาเข้างาน ต้องการออกจากระบบใช่หรือไม่?',
        buttons: [
          { text: 'ยกเลิก', role: 'cancel' },
          {
            text: 'ออกจากระบบ',
            handler: () => {
              this.stopTimer();
              this.authService.logout();
            },
          },
        ],
      });
      await alert.present();
      return;
    }

    // If currently checked in, MUST verify location at the same store
    const alert = await this.alertCtrl.create({
      header: '📍 ยืนยันลงเวลาออกงาน & Logout',
      message:
        'เงื่อนไข: คุณต้องอยู่ที่สถานที่เดิม (เช็คอิน) เพื่อลงเวลาออกงานและออกจากระบบ',
      buttons: [
        { text: 'ยกเลิก', role: 'cancel' },
        {
          text: 'ตรวจพิกัด & ออกจากระบบ',
          handler: () => {
            this.executeCheckOutAndLogout();
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Execute checkout with location validation
   */
  private async executeCheckOutAndLogout() {
    this.isLoading = true;
    this.loadingMessage = 'กำลังตรวจสอบพิกัด GPS ณ สถานที่เดิม...';

    try {
      const coords = await this.getCurrentLocation();
      this.lastCoords = coords;

      this.loadingMessage = 'กำลังตรวจสอบความถูกต้องกับร้าน...';

      const payload = {
        user_id: this.currentUser?.user_id,
        user_name: this.currentUser?.name,
        lat: coords.latitude,
        lng: coords.longitude,
      };

      const res: any = await firstValueFrom(
        this.http.post(`${this.BASE_URL}/api/checkout`, payload)
      );

      this.stopTimer();
      this.isCheckedIn = false;

      await this.showAlert(
        'ลงเวลาออกงานสำเร็จ 🎉',
        `บันทึกเวลาออกงานเรียบร้อย ณ ${res.target_location?.name}\nเวลาปฏิบัติงานรวม: ${this.formatDuration(
          res.duration_minutes
        )} (ระยะห่าง: ${res.distance_meters} ม.)`
      );

      // Logout session
      this.authService.logout();
    } catch (error: any) {
      await this.handleLocationError(error, 'ออกงาน');
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  /**
   * Get device coordinates (or mock test location if enabled)
   */
  private async getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
    if (this.useMockLocation) {
      if (this.mockMode === 'inside') {
        return { latitude: 13.78821, longitude: 100.58031 }; // inside shop
      } else {
        return { latitude: 13.75000, longitude: 100.50000 }; // 5km away
      }
    }

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
   * Location error handler
   */
  private async handleLocationError(error: any, actionType: string) {
    console.error('Location Error:', error);

    if (error.message === 'PERMISSION_DENIED') {
      await this.showAlert(
        'การเข้าถึงตำแหน่งถูกปฏิเสธ',
        'กรุณาอนุญาตให้แอปเข้าถึงตำแหน่ง GPS ในการตั้งค่าของเบราว์เซอร์หรืออุปกรณ์'
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
      const detail = error.error?.detail;
      const msg = typeof detail === 'object' ? detail.message : (detail || error.message);
      await this.showAlert(
        `❌ ไม่สามารถ${actionType}ได้`,
        msg || 'เกิดข้อผิดพลาดในการตรวจสอบพิกัด'
      );
    } else {
      await this.showToast(
        `⚠️ เกิดข้อผิดพลาดในการดึงพิกัดเพื่อ${actionType} กรุณาลองใหม่`,
        'danger',
        3500
      );
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
