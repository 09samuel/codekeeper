import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { Observable, tap } from 'rxjs';

import { AddCollaborator, CollaboratorDialogData } from '../add-collaborator/add-collaborator';
import { Collaborator, CollaboratorStoreService } from './collaborator-store-service';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class AddCollaboratorService {
  private apiUrl = `${environment.API_BASE_URL}/api/collaborators`;

  constructor(
    private dialog: MatDialog,
    private http: HttpClient,
    private collabStore: CollaboratorStoreService
  ) {}

  /** Opens the collaborator dialog */
  openShareDialog(item: any, itemType: 'file' | 'folder'): Observable<any> {
    const dialogRef = this.dialog.open(AddCollaborator, {
      width: '450px',
      data: { item, itemType } as CollaboratorDialogData,
      panelClass: 'custom-dialog-container'
    });

    return dialogRef.afterClosed();
  }

  /** Load collaborators from backend and store them per document */
  loadCollaborators(documentId: string): Observable<{ collaborators: Collaborator[]; owner: any }> {
    return this.http
      .get<{ collaborators: Collaborator[]; owner: any }>(`${this.apiUrl}/${documentId}`)
      .pipe(
        tap(response => {
          this.collabStore.setCurrentDocument(documentId);
          this.collabStore.setAll(response.collaborators, documentId);
        })
      );
  }

  /** Add collaborator to backend then store */
  addCollaborator(
    documentId: string,
    data: { email: string; permission: 'view' | 'edit' }
  ): Observable<Collaborator> {
    return this.http
      .post<Collaborator>(`${this.apiUrl}/${documentId}`, data)
      .pipe(tap(collab => this.collabStore.add(collab, documentId)));
  }

  /** Update collaborator permission */
  updatePermission(
    documentId: string,
    collaboratorId: string,
    permission: 'view' | 'edit'
  ): Observable<any> {
    return this.http
      .put(`${this.apiUrl}/${documentId}/${collaboratorId}`, { permission })
      .pipe(
        tap(() => this.collabStore.updatePermission(collaboratorId, permission, documentId))
      );
  }

  /** Remove collaborator */
  removeCollaborator(documentId: string, collaboratorId: string): Observable<any> {
    return this.http
      .delete(`${this.apiUrl}/${documentId}/${collaboratorId}`)
      .pipe(
        tap(() => this.collabStore.remove(collaboratorId, documentId))
      );
  }
}
