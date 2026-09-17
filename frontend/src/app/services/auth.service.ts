import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface UserProfile {
  user_id: string;
  username: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  status: string;
  message: string;
  token: string;
  user: UserProfile;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Use host LAN IP so both mobile app over Wi-Fi and browser connect cleanly
  private readonly API_URL = 'http://192.168.0.124:8000/api/login';
  private readonly STORAGE_KEY = 'attendance_user_session';

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string):Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.API_URL, { username, password }).pipe(
      tap((res) => {
        if (res.status === 'success' && res.user) {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(res.user));
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  getCurrentUser(): UserProfile | null {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }
}
