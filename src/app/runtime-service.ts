import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { NotificationService } from './services/notification-service';


interface Runtime {
  language: string;
  version: string;
  aliases: string[];
  runtime?: string;
}

export interface LanguageOption {
  language: string;
  version: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root'
})
export class RuntimeService {
  private http = inject(HttpClient);
  private notificationService = inject(NotificationService);
  
  languageOptions = signal<LanguageOption[]>([]);
  private loaded = false;
  private loading = false;

  async loadRuntimes(): Promise<void> {
    // Prevent multiple simultaneous loads
    if (this.loaded || this.loading) {
      return;
    }

    this.loading = true;

    try {
      const result = await firstValueFrom(
        this.http.get<{ success: boolean; runtimes: Runtime[] }>(
          `${environment.API_BASE_URL}/api/code/runtimes`
        )
      );

      if (result.success && result.runtimes) {
        const options: LanguageOption[] = result.runtimes.map(runtime => ({
          language: runtime.language,
          version: runtime.version,
          displayName: `${this.capitalize(runtime.language)} (${runtime.version})`
        }));
        
        this.languageOptions.set(options);
        this.loaded = true;
        console.log(`✓ Loaded ${options.length} language runtimes`);
      }
    } catch (error: any) {
      const errorMsg = error?.error?.error || error?.error?.message || 'Failed to load runtimes';
      console.error('Failed to load runtimes:', error);
      this.notificationService.error(errorMsg);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
