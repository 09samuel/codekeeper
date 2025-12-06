import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationService } from '../services/notification-service';

@Component({
  selector: 'app-ai',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai.html',
  styleUrls: ['./ai.css']
})
export class Ai {
  prompt = signal('');
  response = signal('');
  isLoading = signal(false);

  private http = inject(HttpClient);
  private notificationService = inject(NotificationService);

  async sendPrompt() {
    if (!this.prompt().trim()) return;
    
    this.isLoading.set(true);
    this.response.set('');
    
    try {
      const result = await firstValueFrom(
        this.http.post<{ success: boolean; content: string }>(
        `${environment.API_BASE_URL}/api/ai/generate-text`,
        { prompt: this.prompt() }
      )
      );

      if (result.success && result.content) {
        this.response.set(result.content);
      } else {
        this.response.set('No response received from AI');
      }
      
    } catch (error: any) {
      let errorMsg = 'Failed to get AI response. Please try again.';
      
      if (error.error) {
        // Server returned an error response
        errorMsg = error.error.error || error.error.details || error.error.message || errorMsg;
      } else if (error.message) {
        // Client-side or network error
        errorMsg = error.message;
      }
      this.response.set(`Error: ${errorMsg}`);
      this.notificationService.error(errorMsg); 
      console.error('AI generation error:', error);
    }
    finally {
          this.isLoading.set(false);
    }
  }

  clearChat() {
    this.prompt.set('');
    this.response.set('');
  }
}
