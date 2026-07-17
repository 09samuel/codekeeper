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
    this.loadCollaborators();
    
    // Subscribe to store updates
    this.collabSubscription = this.collaboratorStore.collaborators$.subscribe(list => {
      this.collaborators = list;
    });
  }

  ngOnDestroy() {
    // Clean up subscription on dialog close
    if (this.collabSubscription) {
      this.collabSubscription.unsubscribe();
    }
  }

  loadCollaborators() {
    this.collaboratorService.loadCollaborators(this.data.item._id).subscribe({
      next: (response) => {
        this.collaboratorStore.setCurrentDocument(this.data.item._id);
        this.collaboratorStore.setAll(response.collaborators, this.data.item._id);
        
        this.owner = response.owner;
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

      this.collaboratorService.addCollaborator(this.data.item._id, formData).subscribe({
        next: (newCollaborator) => {
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
    this.collaboratorService.updatePermission(this.data.item._id, collaboratorId, permission).subscribe({
      next: () => {
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
      this.collaboratorService.removeCollaborator(this.data.item._id, collaboratorId).subscribe({
        next: () => {
          this.collaboratorStore.remove(collaboratorId, this.data.item._id);
          this.notification.success('Collaborator removed');
        },
        error: (err) => {
          console.error('❌ Error removing collaborator:', err);
          this.notification.error('Failed to remove collaborator');
        }
      });
    }
  }
}