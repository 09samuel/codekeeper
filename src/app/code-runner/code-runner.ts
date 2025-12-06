import { Component, OnInit, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface Runtime {
  language: string;
  version: string;
  aliases: string[];
  runtime?: string;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  stderr: string;
  exitCode: number;
  language: string;
  version: string;
}

interface LanguageOption {
  language: string;
  version: string;
  displayName: string;
}

@Component({
  selector: 'app-code-runner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './code-runner.html',
  styleUrls: ['./code-runner.css']
})
export class CodeRunner implements OnInit {
  @Input() editorContent: string = ''; // Will receive code from editor
  
  languageOptions = signal<LanguageOption[]>([]);
  selectedLanguage = signal<string>('');
  selectedVersion = signal<string>('');
  stdin = signal<string>('');
  output = signal<string>('');
  isRunning = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    await this.loadRuntimes();
  }

  async loadRuntimes() {
    try {
      const result = await firstValueFrom(
        this.http.get<{ success: boolean; runtimes: Runtime[] }>(`${environment.API_BASE_URL}/api/code/runtimes`)
      );

      if (result.success && result.runtimes) {
        const options: LanguageOption[] = result.runtimes.map(runtime => ({
          language: runtime.language,
          version: runtime.version,
          displayName: `${this.capitalize(runtime.language)} (${runtime.version})`
        }));
        
        this.languageOptions.set(options);
        
        if (options.length > 0) {
          this.selectedLanguage.set(options[0].language);
          this.selectedVersion.set(options[0].version);
        }
        
        console.log(`✓ Loaded ${options.length} language runtimes`);
      }
    } catch (error) {
      console.error('Failed to load runtimes:', error);
      this.output.set('Error: Failed to load available languages');
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
    // Get code from editor input
    const code = this.editorContent;
    
    if (!code.trim()) {
      this.output.set('Error: No code to run. Please write some code in the editor.');
      return;
    }

    this.isRunning.set(true);
    this.output.set('Running code...');

    try {
      const result = await firstValueFrom(
        this.http.post<ExecutionResult>(`${environment.API_BASE_URL}/api/code/execute`, {
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
      } else {
        this.output.set('Error: Code execution failed');
      }

    } catch (error: any) {
      const errorMsg = error?.error?.error || 'Failed to execute code';
      this.output.set(`Error: ${errorMsg}\n\n${error?.error?.details || ''}`);
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
