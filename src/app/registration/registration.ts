import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth-service';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../services/notification-service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registration.html',
  styleUrl: './registration.css'
})
export class Registration {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);

  registerForm: FormGroup = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
    confirmPassword: new FormControl('', [Validators.required])
  }, { validators: passwordMatchValidator });

  onSubmit() {
    // Mark all fields as touched
    this.registerForm.markAllAsTouched();

    // Check for required fields
    if (this.registerForm.get('name')?.hasError('required')) {
      this.notification.error('Name is required');
      return;
    }

    if (this.registerForm.get('name')?.hasError('minlength')) {
      this.notification.error('Name must be at least 2 characters long');
      return;
    }

    if (this.registerForm.get('email')?.hasError('required')) {
      this.notification.error('Email is required');
      return;
    }

    if (this.registerForm.get('email')?.hasError('email')) {
      this.notification.error('Please enter a valid email address');
      return;
    }

    if (this.registerForm.get('password')?.hasError('required')) {
      this.notification.error('Password is required');
      return;
    }

    if (this.registerForm.get('password')?.hasError('minlength')) {
      this.notification.error('Password must be at least 8 characters long');
      return;
    }

    if (this.registerForm.get('confirmPassword')?.hasError('required')) {
      this.notification.error('Please confirm your password');
      return;
    }

    // Check for password mismatch
    if (this.registerForm.hasError('passwordMismatch')) {
      this.notification.error('Passwords do not match');
      return;
    }

    // Check for any other validation errors
    if (this.registerForm.invalid) {
      this.notification.error('Please fill in all required fields correctly');
      return;
    }

    const { name, email, password } = this.registerForm.value;

    this.http.post(`${environment.API_BASE_URL}/api/auth/register`, { name, email, password }).subscribe({
      next: (response: any) => {
        console.log('Registration successful', response);
        this.notification.success('Registration successful! Verification email sent.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        const backendMsg = err?.error?.error || err?.error?.message;
        const message = backendMsg || 'Registration failed. Please try again.';
        this.notification.error(message);
        console.error('Registration failed', err);
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}

/** Custom validator to check if password === confirmPassword */
function passwordMatchValidator(control: AbstractControl) {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}
