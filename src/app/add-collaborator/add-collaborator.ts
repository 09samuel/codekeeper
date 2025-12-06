import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AddCollaboratorService } from '../services/add-collaborator-service';
import { CollaboratorStoreService } from '../services/collaborator-store-service';
import { NotificationService } from '../services/notification-service';
import { Subscription } from 'rxjs';

export interface CollaboratorDialogData {
  item: any;
  itemType: 'file' | 'folder';
}

export interface Collaborator {
  _id: string;
  name: string;
  email: string;
  permission: 'view' | 'edit';
  addedAt: string;
}

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './add-collaborator.html',
  styleUrl: './add-collaborator.css'
})

export class AddCollaborator implements OnInit, OnDestroy {
  addCollaboratorForm: FormGroup;
  collaborators: Collaborator[] = [];
  owner: any;
  isAddingCollaborator = false;
  private collabSubscription: Subscription | null = null;

  constructor(
    public dialogRef: MatDialogRef<AddCollaborator>,
    @Inject(MAT_DIALOG_DATA) public data: CollaboratorDialogData,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private collaboratorService: AddCollaboratorService,
    private collaboratorStore: CollaboratorStoreService,
    private notification: NotificationService
  ) {
    this.addCollaboratorForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      permission: ['view', Validators.required]
    });
  }

  ngOnInit() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎬 AddCollaborator dialog opened');
    console.log('   Document ID:', this.data.item._id);
    console.log('   Item type:', this.data.itemType);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    this.loadCollaborators();
    
    // Subscribe to store updates
    this.collabSubscription = this.collaboratorStore.collaborators$.subscribe(list => {
      console.log('🔔 AddCollaborator received collaborators$ update');
      console.log('   Previous count:', this.collaborators.length);
      console.log('   New count:', list.length);
      console.log('   New list:', list.map(c => ({ id: c._id, email: c.email })));
      
      this.collaborators = list;
    });
  }

  ngOnDestroy() {
    console.log('🧹 AddCollaborator dialog closing');
    
    // Clean up subscription on dialog close
    if (this.collabSubscription) {
      this.collabSubscription.unsubscribe();
      console.log('   ✓ Collaborator subscription cleaned up');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  loadCollaborators() {
    console.log('📥 loadCollaborators() called');
    console.log('   Loading for document:', this.data.item._id);
    
    this.collaboratorService.loadCollaborators(this.data.item._id).subscribe({
      next: (response) => {
        console.log('✅ Backend returned collaborators:');
        console.log('   Count:', response.collaborators.length);
        console.log('   Owner:', response.owner);
        console.log('   Collaborators:', response.collaborators.map((c: any) => ({ 
          id: c._id, 
          email: c.email 
        })));
        
        console.log('📌 Setting current document in store:', this.data.item._id);
        this.collaboratorStore.setCurrentDocument(this.data.item._id);
        
        console.log('📌 Setting all collaborators in store');
        this.collaboratorStore.setAll(response.collaborators, this.data.item._id);
        
        this.owner = response.owner;
        console.log('✓ Initial collaborators loaded');
      },
      error: (err) => {
        console.error('❌ Error loading collaborators:', err);
        this.notification.error('Failed to load collaborators');
      }
    });
    
  }

  addCollaborator() {
    if (this.addCollaboratorForm.valid) {
      this.isAddingCollaborator = true;
      const formData = this.addCollaboratorForm.value;

      console.log('➕ Adding collaborator:', formData.email);

      this.collaboratorService.addCollaborator(this.data.item._id, formData).subscribe({
        next: (newCollaborator) => {
          console.log('✅ Backend returned new collaborator:', newCollaborator);
          console.log('   Adding to store for document:', this.data.item._id);
          
          this.collaboratorStore.add(newCollaborator, this.data.item._id);
          this.addCollaboratorForm.reset({ permission: 'view' });
          this.notification.success('Collaborator added successfully');
          this.isAddingCollaborator = false;
        },
        error: (error) => {
          console.error('❌ Error adding collaborator:', error);
          this.notification.error(error.error?.error || 'Failed to add collaborator');
          this.isAddingCollaborator = false;
        }
      });
    }
  }

  updatePermission(collaboratorId: string, permission: 'view' | 'edit') {
    console.log('🔄 Updating permission for:', collaboratorId, 'to:', permission);
    
    this.collaboratorService.updatePermission(this.data.item._id, collaboratorId, permission).subscribe({
      next: () => {
        console.log('✅ Permission updated in backend');
        this.collaboratorStore.updatePermission(collaboratorId, permission, this.data.item._id);
        this.notification.success('Permission updated');
      },
      error: (err) => {
        console.error('❌ Error updating permission:', err);
        this.notification.error('Failed to update permission');
      }
    });
  }

  removeCollaborator(collaboratorId: string) {
    if (confirm('Are you sure you want to remove this collaborator?')) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🗑️ removeCollaborator() called from dialog');
      console.log('   collaboratorId:', collaboratorId);
      console.log('   documentId:', this.data.item._id);
      
      this.collaboratorService.removeCollaborator(this.data.item._id, collaboratorId).subscribe({
        next: () => {
          console.log('✅ Backend confirmed removal');
          console.log('   Now calling store.remove()');
          console.log('   With collaboratorId:', collaboratorId);
          console.log('   With documentId:', this.data.item._id);
          
          this.collaboratorStore.remove(collaboratorId, this.data.item._id);
          this.notification.success('Collaborator removed');
          console.log('✓ Store.remove() completed');
        },
        error: (err) => {
          console.error('❌ Error removing collaborator:', err);
          this.notification.error('Failed to remove collaborator');
        }
      });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }
}