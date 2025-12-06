import { Component, OnInit, signal, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationService } from '../services/notification-service';
import { RuntimeService } from '../runtime-service';


@Component({
  selector: 'app-code-runner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './code-runner.html',
  styleUrls: ['./code-runner.css']
})
export class CodeRunner implements OnInit {
  private http = inject(HttpClient);
  private notificationService = inject(NotificationService);
  private runtimeService = inject(RuntimeService);
  
  @Input() editorContent: string = '';
  
  selectedLanguage = signal<string>('');
  selectedVersion = signal<string>('');
  stdin = signal<string>('');
  output = signal<string>('');
  isRunning = signal<boolean>(false);

  // Access shared language options from service
  get languageOptions() {
    return this.runtimeService.languageOptions;
  }

  ngOnInit() {
    // Just set default language from already-loaded runtimes
    const options = this.languageOptions();
    if (options.length > 0 && !this.selectedLanguage()) {
      this.selectedLanguage.set(options[0].language);
      this.selectedVersion.set(options[0].version);
    }
  }

  capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  onLanguageChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const selectedOption = select.value;
    
    if (!selectedOption) return;
    
    const [language, version] = selectedOption.split(':');
    this.selectedLanguage.set(language);
    this.selectedVersion.set(version);
    this.output.set('');
  }

  onStdinChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.stdin.set(textarea.value);
  }

  async runCode() {
    const code = this.editorContent;
    
    if (!code.trim()) {
      const errorMsg = 'No code to run. Please write some code in the editor.';
      this.output.set(`Error: ${errorMsg}`);
      this.notificationService.error(errorMsg);
      return;
    }

    this.isRunning.set(true);
    this.output.set('Running code...');

    try {
      const result = await firstValueFrom(
        this.http.post<any>(`${environment.API_BASE_URL}/api/code/execute`, {
          language: this.selectedLanguage(),
          version: this.selectedVersion(),
          code: code,
          stdin: this.stdin()
        })
      );

      if (result.success) {
        let outputText = '';
        
        if (result.output) {
          outputText += result.output;
        }
        
        if (result.stderr) {
          outputText += '\n--- STDERR ---\n' + result.stderr;
        }
        
        outputText += `\n\n--- Execution Info ---\nLanguage: ${result.language} ${result.version}\nExit Code: ${result.exitCode}`;
        
        this.output.set(outputText || 'Program executed successfully (no output)');
        
        if (result.exitCode === 0) {
          this.notificationService.success('Code executed successfully!');
        } else {
          this.notificationService.error(`Code executed with exit code: ${result.exitCode}`);
        }
      } else {
        const errorMsg = 'Code execution failed';
        this.output.set(`Error: ${errorMsg}`);
        this.notificationService.error(errorMsg);
      }

    } catch (error: any) {
      const errorMsg = error?.error?.error || error?.error?.message || 'Failed to execute code';
      const details = error?.error?.details || '';
      this.output.set(`Error: ${errorMsg}\n\n${details}`);
      this.notificationService.error(errorMsg);
      console.error('Code execution error:', error);
    } finally {
      this.isRunning.set(false);
    }
  }

  clearOutput() {
    this.output.set('');
    this.stdin.set('');
  }
}
