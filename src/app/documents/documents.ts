import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentService } from '../services/document-service';

@Component({
  selector: 'app-documents',
  imports: [],
  templateUrl: './documents.html',
  styleUrl: './documents.css'
})

export class DocumentsComponent {
  constructor(private router: Router, private docService: DocumentService) {}

  createNewDocument() {
    this.docService.createDocument({ title: 'Untitled', content: '' }).subscribe({
      next: (saved) => {
        console.log('Created doc:', saved);
        // Navigate to editor with docId
        this.router.navigate(['/editor', saved._id]);
      },
      error: (err) => console.error(err)
    });
  }
}
