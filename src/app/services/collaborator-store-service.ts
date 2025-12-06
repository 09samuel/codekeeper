import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

export interface Collaborator {
  _id: string;
  name: string;
  email: string;
  permission: 'view' | 'edit';
  addedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CollaboratorStoreService {
  // Store collaborators per document
  private collaboratorsByDocument = new Map<string, Collaborator[]>();
  private collaboratorsSubject = new BehaviorSubject<Collaborator[]>([]);
  private collaboratorAddedSubject = new Subject<Collaborator & { documentId: string }>();
  private collaboratorRemovedSubject = new Subject<{userId: string, documentId: string}>();
  private currentDocumentId: string | null = null;

  collaboratorAdded$ = this.collaboratorAddedSubject.asObservable();
  collaboratorRemoved$ = this.collaboratorRemovedSubject.asObservable();
  public collaborators$: Observable<Collaborator[]> = this.collaboratorsSubject.asObservable();

  setCurrentDocument(documentId: string) {
    this.currentDocumentId = documentId;
    console.log('📄 Store context set to document:', documentId);
    
    // Emit the collaborators for this document
    const collaborators = this.collaboratorsByDocument.get(documentId) || [];
    this.collaboratorsSubject.next(collaborators);
    console.log(`📋 Loaded ${collaborators.length} collaborators for document ${documentId}`);
  }

  setAll(collaborators: Collaborator[], documentId?: string) {
    const docId = documentId || this.currentDocumentId;
    
    if (!docId) {
      console.warn('⚠️ Cannot setAll: no document context');
      return;
    }
    
    // Store collaborators for this specific document
    this.collaboratorsByDocument.set(docId, collaborators);
    
    // If this is the current document, update the subject
    if (docId === this.currentDocumentId) {
      this.collaboratorsSubject.next(collaborators);
    }
    
    console.log(`✓ Loaded ${collaborators.length} collaborators for document ${docId}`);
  }

  clear() {
    console.log('🧹 Clearing collaborators store for document:', this.currentDocumentId);
    
    if (this.currentDocumentId) {
      this.collaboratorsByDocument.delete(this.currentDocumentId);
    }
    
    this.collaboratorsSubject.next([]);
    this.currentDocumentId = null;
  }

  add(collaborator: Collaborator, documentId?: string) {
    const docId = documentId || this.currentDocumentId;
    
    if (!docId) {
      console.warn('⚠️ Cannot add collaborator: no document context');
      return;
    }
    
    // Get collaborators for this specific document
    const current = this.collaboratorsByDocument.get(docId) || [];
    const exists = current.find(c => c._id === collaborator._id);

    if (!exists) {
      console.log(`➕ Adding collaborator ${collaborator.email} to document ${docId}`);
      
      const updated = [...current, collaborator];
      this.collaboratorsByDocument.set(docId, updated);
      
      // If this is the current document, update the subject
      if (docId === this.currentDocumentId) {
        this.collaboratorsSubject.next(updated);
      }
      
      // Emit event with document ID
      this.collaboratorAddedSubject.next({ ...collaborator, documentId: docId });
      console.log('✅ collaboratorAdded$ event emitted for:', collaborator.email);
    } else {
      console.log(`⚠️ Collaborator ${collaborator.email} already exists in document ${docId}`);
    }
  }

  remove(collaboratorId: string, documentId: string) {
  const current = this.collaboratorsByDocument.get(documentId) || [];
  const filtered = current.filter(c => c._id !== collaboratorId);

  const existed = current.length !== filtered.length;

  if (existed) {
    console.log(`➖ Removing collaborator ${collaboratorId} from document ${documentId}`);
    this.collaboratorsByDocument.set(documentId, filtered);

    if (documentId === this.currentDocumentId) {
      this.collaboratorsSubject.next(filtered);
    }

    this.collaboratorRemovedSubject.next({ userId: collaboratorId, documentId });
    console.log('✅ collaboratorRemoved$ event emitted (removed existing)');
    return;
  }

  console.log(`⚠️ Attempted to remove collaborator ${collaboratorId} from document ${documentId} but it was not present locally — still emitting removed event`);
  this.collaboratorRemovedSubject.next({ userId: collaboratorId, documentId });
}


  updatePermission(collaboratorId: string, permission: 'edit' | 'view', documentId?: string) {
    const docId = documentId || this.currentDocumentId;
    
    if (!docId) {
      console.warn('⚠️ Cannot update permission: no document context');
      return;
    }
    
    const current = this.collaboratorsByDocument.get(docId) || [];
    const updated = current.map(c => 
      c._id === collaboratorId ? { ...c, permission } : c
    );
    
    this.collaboratorsByDocument.set(docId, updated);
    
    // If this is the current document, update the subject
    if (docId === this.currentDocumentId) {
      this.collaboratorsSubject.next(updated);
    }
    
    console.log(`🔄 Updated permission for ${collaboratorId} in document ${docId} to ${permission}`);
  }

  getUserPermission$(userId: string, documentId: string): Observable<'edit' | 'view'>{
    return this.collaborators$.pipe(
      map(() => {
        const collaborators = this.getCollaboratorsForDocument(documentId);
        const user = collaborators.find(c => c._id === userId);
        return user?.permission || 'view';
      }),
      distinctUntilChanged()
    );
  }

    
  getCurrentPermission(userId: string, documentId?: string): 'edit' | 'view' {
    const docId = documentId || this.currentDocumentId;
    
    if (!docId) {
      return 'view';
    }
    
    const collaborators = this.collaboratorsByDocument.get(docId) || [];
    const user = collaborators.find(c => c._id === userId);
    return user?.permission || 'view';
  }

  // Helper to get collaborators for any document
  getCollaboratorsForDocument(documentId: string): Collaborator[] {
    return this.collaboratorsByDocument.get(documentId) || [];
  }
}