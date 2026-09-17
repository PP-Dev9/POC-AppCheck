import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  IonChip,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  restaurantOutline,
  personOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  personCircleOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
    IonChip,
  ],
})
export class LoginPage {
  username = '';
  password = '';
  showPassword = false;
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController
  ) {
    addIcons({
      restaurantOutline,
      personOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      personCircleOutline,
      shieldCheckmarkOutline,
    });

    // If already logged in, navigate straight to home
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/home'], { replaceUrl: true });
    }
  }

  async onLogin() {
    if (!this.username || !this.password) return;

    this.isLoading = true;

    this.authService.login(this.username, this.password).subscribe({
      next: async (res) => {
        this.isLoading = false;
        await this.showToast(`ยินดีต้อนรับคุณ ${res.user.name}`, 'success');
        this.router.navigate(['/home'], { replaceUrl: true });
      },
      error: async (err) => {
        this.isLoading = false;
        const msg = err.error?.detail || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        await this.showToast(msg, 'danger');
      },
    });
  }

  quickLogin(u: string, p: string) {
    this.username = u;
    this.password = p;
    this.onLogin();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      buttons: [{ text: 'ปิด', role: 'cancel' }],
    });
    await toast.present();
  }
}
