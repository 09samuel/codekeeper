import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {

  constructor(private snackBar: MatSnackBar) {}

  success(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['bg-green-600', 'text-white']
    });
  }

  error(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['bg-red-600', 'text-white']
    });
  }

  info(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['bg-blue-600', 'text-white']
    });
  }

  warn(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['bg-yellow-500', 'text-white']
    });
  }
}
