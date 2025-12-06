import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private http = inject(HttpClient);
  
  private apiUrl = 'http://localhost:3000/api/documents';

  // Signal for triggering refresh across components
  private refreshSignal = signal<number>(0);
  
  // Public computed signal for components to react to
  readonly refresh$ = computed(() => this.refreshSignal());

  triggerRefresh(): void {
    this.refreshSignal.update(v => v + 1);
  }

  createDocument(data: { 
    title: string; 
    content: string; 
    parentFolderId?: string | null; 
    type?: string 
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      ...data,
      type: data.type || 'file'
    }).pipe(
      tap(() => this.triggerRefresh())
    );
  }

  createFolder(data: { 
    title: string; 
    parentFolderId?: string | null 
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/folders`, {
      title: data.title,
      parentFolderId: data.parentFolderId,
      type: 'folder',
      content: ''
    }).pipe(
      tap(() => this.triggerRefresh())
    );
  }

  deleteItem(docId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${docId}`).pipe(
      tap(() => this.triggerRefresh())
    );
  }

  renameItem(docId: string, data: { title: string }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${docId}`, data).pipe(
      tap(() => this.triggerRefresh())
    );
  }

  // Read operations - Keep as Observable (Resource API is experimental)
  getUserDocuments(folderId: string | null): Observable<any[]> {
    let httpParams = new HttpParams();
    if (folderId) {
      httpParams = httpParams.set('folder', folderId);
    }
    
    return this.http.get<any[]>(this.apiUrl, { 
      params: httpParams 
    });
  }

  getFolderContents(folderId?: string): Observable<any[]> {
    let httpParams = new HttpParams();
    if (folderId) {
      httpParams = httpParams.set('folder', folderId);
    }
    
    return this.http.get<any[]>(this.apiUrl, { 
      params: httpParams 
    });
  }

  getDocumentById(docId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${docId}`);
  }

  checkOwnership(itemId: string): Observable<{ isOwner: boolean }> {
    return this.http.get<{ isOwner: boolean }>(
      `${this.apiUrl}/${itemId}/ownership`
    );
  }

  getDocumentPermission(documentId: string): Observable<{ permission: 'edit' | 'view' }> {
    return this.http.get<{ permission: 'edit' | 'view' }>(
      `${this.apiUrl}/${documentId}/permission`
    );
  }

  getDocumentSignedUrl(docId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.apiUrl}/signed-url?id=${docId}`
    );
  }
}
