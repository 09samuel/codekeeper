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
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirmPassword: new FormControl('', [Validators.required])
  }, { validators: passwordMatchValidator });

  onSubmit() {
    if (this.registerForm.valid) {
      const { name, email, password } = this.registerForm.value;

      this.http.post(`${environment.API_BASE_URL}/api/auth/register`, { name, email, password }).subscribe({
        next: (response: any) => {
          console.log('Registration successful', response);
          this.notification.success('Registration successful! Verification email sent.');
          this.router.navigate(['/login']);
        },
        error: (err) => {
          const backendMsg = err?.error?.message;
          this.notification.error(backendMsg || 'Registration failed. Please try again.');
        }
      });
    } else {
      console.error('Form is invalid', this.registerForm.errors);
      this.registerForm.markAllAsTouched();
    }
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
