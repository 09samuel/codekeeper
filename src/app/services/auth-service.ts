import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { jwtDecode } from 'jwt-decode';
import { firstValueFrom, Observable } from 'rxjs';

interface JwtPayload {
  sub: string;
  type: string;
  exp: number;
  iat: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'accessToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';

  constructor(private http: HttpClient) {}

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp <= now;
    } catch (e) {
      console.error('Invalid token:', e);
      return true; // treat as expired if can't decode
    }
  }

  async refreshTokens(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response: any = await firstValueFrom(
        this.http.post('http://localhost:3000/api/auth/refresh', { refreshToken })
      );

      this.setTokens(response.accessToken, response.refreshToken);
      return true;
    } catch (e) {
      console.error('Token refresh failed:', e);
      this.clearTokens();
      return false;
    }
  }

  refreshTokens$(): Observable<{ accessToken: string; refreshToken: string }> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<{ accessToken: string; refreshToken: string }>(
      'http://localhost:3000/api/auth/refresh',
      { refreshToken }
    );
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();

    try {
      if (refreshToken) {
        // Inform backend to invalidate refresh token
        await firstValueFrom(this.http.post(`http://localhost:3000/api/auth/logout`, { refreshToken }));
      }
    } catch (err) {
      console.warn('Logout API failed (continuing local logout):', err);
    } finally {
      // Always clear tokens locally
      this.clearTokens();


    }
  }

  getCurrentUserId(): string | null {
  try {
    const currentUser = localStorage.getItem('currentUser');
    
    if (!currentUser) {
      console.warn('⚠️ No currentUser found in localStorage');
      return null;
    }
    
    const userData = JSON.parse(currentUser);
    const userId = userData?._id || userData?.id;
    
    if (!userId) {
      console.error('❌ User data exists but no _id or id field found:', userData);
      return null;
    }
    
    console.log('✅ Found user ID:', userId);
    return userId;
  } catch (error) {
    console.error('❌ Error parsing currentUser from localStorage:', error);
    return null;
  }
}
}
