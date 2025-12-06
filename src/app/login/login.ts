import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth-service';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../services/notification-service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  constructor(private router: Router) {}

  goToRegister() {
    this.router.navigate(['/register']);
  }

  loginForm: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)])
  });

  http = inject(HttpClient);
  route = inject(Router);
  authService = inject(AuthService);
  notificationService = inject(NotificationService)

  async ngOnInit() {
    const token = this.authService.getAccessToken();

    if (token && !this.authService.isTokenExpired(token)) {
      console.log('Already logged in. Redirecting to /documents...');

      this.route.navigate(['/home']).then(() => {
          window.history.replaceState(null, '', '/home'); // removes previous entry from history
      });

      return;
    }

    if (token && this.authService.isTokenExpired(token)) {
      console.log('Access token expired. Trying refresh...');
      const refreshed = await this.authService.refreshTokens();
      if (refreshed) {
        console.log('Token refreshed. Redirecting to /home...');

        this.route.navigate(['/home']).then(() => {
          window.history.replaceState(null, '', '/home'); // removes previous entry from history
        });
      }
    }
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      console.log('Form submitted with:', { email, password });

    try {
      const response: any = await firstValueFrom(
        this.http.post(`${environment.API_BASE_URL}/api/auth/login`, { email, password })
      );

      if (response.accessToken && response.refreshToken) {
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        
        localStorage.setItem('currentUser', JSON.stringify(response.user));

        this.route.navigate(['/home']).then(() => {
          window.history.replaceState(null, '', '/home');
        });
      } else {
        this.notificationService.success(response.message || 'Login failed. Please try again.');
        console.error('Login failed', response.message);
      }

    } catch (err: any) {
      const backendMsg = err?.error?.message;
      const message = backendMsg || 'Login failed. Please try again.';

      this.notificationService.error(message);
      console.error('Login failed', err);
    }

  }
}

}