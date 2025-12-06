import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

export interface FileDialogData {
  title: string;     
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
}

@Component({
  selector: 'app-file-dialog',
  templateUrl: './file-dialog.html',
  imports: [ReactiveFormsModule],
  styleUrl: './file-dialog.css'
})
export class FileDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<FileDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FileDialogData
  ) {
    this.form = this.fb.group({
      value: [data.defaultValue || '', Validators.required]
    });
  }

  submit() {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value.value);
    }
  }

  close() {
    this.dialogRef.close(null);
  }
}
