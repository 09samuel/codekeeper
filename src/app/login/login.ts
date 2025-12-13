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
    password: new FormControl('', [Validators.required, Validators.minLength(8)])
  });

  http = inject(HttpClient);
  route = inject(Router);
  authService = inject(AuthService);
  notificationService = inject(NotificationService);

  forgotPasswordEmail: string = '';
  showForgotPasswordInput: boolean = false;

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
    // Check if form is invalid
    if (this.loginForm.invalid) {
      // Mark all fields as touched to show which ones are invalid
      this.loginForm.markAllAsTouched();
      
      // Show notification for validation errors
      if (this.loginForm.get('email')?.hasError('required')) {
        this.notificationService.error('Email is required');
        return;
      }
      if (this.loginForm.get('email')?.hasError('email')) {
        this.notificationService.error('Please enter a valid email address');
        return;
      }
      if (this.loginForm.get('password')?.hasError('required')) {
        this.notificationService.error('Password is required');
        return;
      }
      if (this.loginForm.get('password')?.hasError('minlength')) {
        this.notificationService.error('Password must be at least 8 characters');
        return;
      }
      return;
    }

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
        this.notificationService.error(response.message || 'Login failed. Please try again.');
        console.error('Login failed', response.message);
      }

    } catch (err: any) {
      const backendMsg = err?.error?.message;
      const message = backendMsg || 'Login failed. Please try again.';

      this.notificationService.error(message);
      console.error('Login failed', err);
    } 
  }


  async onForgotPassword() {
    // Get email from the existing login form
    const email = this.loginForm.get('email')?.value;
    
    if (!email) {
      this.notificationService.error('Please enter your email address first');
      return;
    }

    // Check if email is valid using the form's validation
    if (this.loginForm.get('email')?.invalid) {
      this.notificationService.error('Please enter a valid email address');
      return;
    }

    try {
      const response: any = await firstValueFrom(
        this.http.post(`${environment.API_BASE_URL}/api/auth/forgot-password`, { email })
      );

      this.notificationService.success(
        'If that email exists, a password reset link has been sent. Please check your inbox.'
      );
      console.log('Forgot password response:', response);

    } catch (err: any) {
      const backendMsg = err?.error?.error || err?.error?.message;
      const message = backendMsg || 'Failed to send reset email. Please try again.';
      
      this.notificationService.error(message);
      console.error('Forgot password failed', err);
    }
  }
}