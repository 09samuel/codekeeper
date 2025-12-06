import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth-service';


export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Skip interceptor for login and register
  const excludedUrls = ['/login', '/register', '/refresh',];
  const isExcluded = excludedUrls.some(url => req.url.includes(url));

  if (isExcluded) {
    return next(req);
  }

  const token = authService.getAccessToken();

  const authReq = req.clone({
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {}
  });

  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 401) {
        const refreshToken = authService.getRefreshToken();

        if (!refreshToken) {
          console.error('No refresh token');
          authService.clearTokens();
          router.navigate(['']);
          return throwError(() => err);
        }

        return authService.refreshTokens$().pipe(
          switchMap(res => {
            authService.setTokens(res.accessToken, res.refreshToken);

            const retryReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${res.accessToken}`
              }
            });

            return next(retryReq);
          }),
          catchError(refreshErr => {
            console.error('Token refresh failed');
            authService.clearTokens();
            router.navigate(['/login']);
            return throwError(() => refreshErr);
          })
        );
      }

      return throwError(() => err);
    })
  );
};
