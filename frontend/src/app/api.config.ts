import { Capacitor } from '@capacitor/core';

export function getApiBaseUrl(): string {
  // 1. Check if user configured a custom URL in localStorage (useful for debugging)
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('CUSTOM_API_URL');
    if (custom) {
      return custom.replace(/\/+$/, '');
    }
  }

  // 2. If running inside native Android/iOS Capacitor app
  if (Capacitor.isNativePlatform()) {
    return 'https://attendance-backend-hx6k.onrender.com';
  }

  // 3. If running in browser locally (localhost / 127.0.0.1)
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }

  // 4. Default Production Cloud Backend (Render)
  return 'https://attendance-backend-hx6k.onrender.com';
}
