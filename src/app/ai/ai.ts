import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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

  constructor(private http: HttpClient) {}

  async sendPrompt() {
    if (!this.prompt().trim()) return;
    
    this.isLoading.set(true);
    this.response.set('');
    
    try {
      const result = await firstValueFrom(
        this.http.post<{ success: boolean; content: string }>('http://localhost:3000/api/ai/generate-text', {
          prompt: this.prompt()
        })
      );

      if (result.success && result.content) {
        this.response.set(result.content);
      } else {
        this.response.set('No response received from AI');
      }
      
    } catch (error: any) {
      const errorMsg = error?.error?.error || 'Failed to get AI response. Please try again.';
      this.response.set(`Error: ${errorMsg}`);
      console.error('AI generation error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  clearChat() {
    this.prompt.set('');
    this.response.set('');
  }
}
