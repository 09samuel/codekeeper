import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const loginGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('accessToken');

  if (token) {
    router.navigate(['/documents']); // redirect to home/dashboard
    return false; // block login/register
  }

  return true; // allow access if not logged in
};
