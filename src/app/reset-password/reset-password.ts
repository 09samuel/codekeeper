import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../services/notification-service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true,
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  token: string = '';
  isSubmitting: boolean = false;

  http = inject(HttpClient);
  route = inject(ActivatedRoute);
  router = inject(Router);
  notificationService = inject(NotificationService);

  constructor() {
    this.resetForm = new FormGroup({
      newPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
      confirmPassword: new FormControl('', [Validators.required])
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    this.token = this.route.snapshot.queryParams['token'] || '';
    
    if (!this.token) {
      this.notificationService.error('Invalid or missing reset token');
      this.router.navigate(['/login']);
    }
  }

  passwordMatchValidator(control: AbstractControl) {
    const group = control as FormGroup;
    const password = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password === confirm ? null : { passwordMismatch: true };
  }

  async onSubmit() {
    // Mark all fields as touched to trigger validation display
    this.resetForm.markAllAsTouched();

    // Check for required fields
    if (this.resetForm.get('newPassword')?.hasError('required')) {
      this.notificationService.error('New password is required');
      return;
    }

    if (this.resetForm.get('confirmPassword')?.hasError('required')) {
      this.notificationService.error('Please confirm your password');
      return;
    }

    // Check password length
    if (this.resetForm.get('newPassword')?.hasError('minlength')) {
      this.notificationService.error('Password must be at least 8 characters long');
      return;
    }

    // Check for password mismatch
    if (this.resetForm.hasError('passwordMismatch')) {
      this.notificationService.error('Passwords do not match');
      return;
    }

    // Check for any other validation errors
    if (this.resetForm.invalid) {
      this.notificationService.error('Please fill in all required fields correctly');
      return;
    }

    this.isSubmitting = true;

    try {
      const response: any = await firstValueFrom(
        this.http.post(`${environment.API_BASE_URL}/api/auth/reset-password`, {
          token: this.token,
          newPassword: this.resetForm.value.newPassword
        })
      );

      this.notificationService.success('Password reset successful! Please log in with your new password.');
      this.router.navigate(['/login']);

    } catch (err: any) {
      const backendMsg = err?.error?.error || err?.error?.message;
      const message = backendMsg || 'Failed to reset password. Please try again.';
      
      this.notificationService.error(message);
      console.error('Reset password failed', err);
    } finally {
      this.isSubmitting = false;
    }
  }



  goToLogin() {
    this.router.navigate(['/login']);
  }
}
