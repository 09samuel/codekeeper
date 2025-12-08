import {
  Component,
  OnInit,
  signal,
  computed,
  DestroyRef,
  inject,
  output,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DocumentService } from '../services/document-service';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import {
  firstValueFrom,
  lastValueFrom,
  filter,
  merge,
  tap,
} from 'rxjs';
import { AddCollaboratorService } from '../services/add-collaborator-service';
import { CollaboratorStoreService } from '../services/collaborator-store-service';
import { AuthService } from '../services/auth-service';
import { MatDialog } from '@angular/material/dialog';
import { FileDialogComponent } from '../file-dialog/file-dialog';
import { NotificationService } from '../services/notification-service';

interface Document {
  _id: string;
  title: string;
  type: 'file' | 'folder';
  isOwner?: boolean;
  content?: string;
}

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatMenuModule, MatButtonModule],
  templateUrl: './files.html',
  styleUrls: ['./files.css'],
})
export class Files implements OnInit {
  private docService = inject(DocumentService);
  private addCollaboratorService = inject(AddCollaboratorService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  private collabStore = inject(CollaboratorStoreService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);


  documents = signal<Document[]>([]);
  isLoading = signal<boolean>(true);
  currentFolderId = signal<string | null>(null);
  breadcrumbs = signal<Document[]>([]);

  folders = computed(() => this.documents().filter((d) => d.type === 'folder'));
  files = computed(() => this.documents().filter((d) => d.type === 'file'));

  fileSelected = output<{ _id: string; title: string; content?: string }>();
  fileDeleted = output<string>();
  fileRenamed = output<{ _id: string; newTitle: string }>();

  constructor() {
    const currentUserId = this.auth.getCurrentUserId();
    
    console.log('🎯 Files component initialized');
    console.log('   Current userId:', currentUserId);
    console.log('   userId type:', typeof currentUserId);
    console.log('   userId length:', currentUserId?.length);

    merge(
      // Collaborator added for current user
      this.collabStore.collaboratorAdded$.pipe(
        tap((e) => {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📨 ADDED EVENT RECEIVED');
          console.log('   Raw event:', e);
          console.log('   event._id:', e?._id);
          console.log('   event._id type:', typeof e?._id);
          console.log('   event.documentId:', e?.documentId);
        }),
        filter((e) => {
          console.log('🔍 ADDED FILTER CHECK:');
          console.log('   e exists?', !!e);
          console.log('   e._id:', e?._id);
          console.log('   currentUserId:', currentUserId);
          console.log('   e._id === currentUserId?', e?._id === currentUserId);
          console.log('   !!e.documentId?', !!e?.documentId);
          
          const isValid = e && e._id === currentUserId && !!e.documentId;
          console.log('   → FINAL RESULT:', isValid);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          return isValid;
        }),
        tap(() => console.log('✅ Collaborator ADDED - triggering refresh'))
      ),

      // Collaborator removed for current user
      this.collabStore.collaboratorRemoved$.pipe(
        tap((e) => {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📨 REMOVED EVENT RECEIVED');
          console.log('   Raw event:', e);
          console.log('   event._id:', e?.userId);
          console.log('   event._id type:', typeof e?.userId);
          console.log('   event._id length:', e?.userId?.length);
          console.log('   event.documentId:', e?.documentId);
        }),
        filter((e) => {
          console.log('🔍 REMOVED FILTER CHECK:');
          console.log('   e exists?', !!e);
          console.log('   e._id:', e?.userId);
          console.log('   currentUserId:', currentUserId);
          console.log('   e._id === currentUserId?', e?.userId === currentUserId);
          console.log('   Strict equality:', e?.userId, '===', currentUserId, '→', e?.userId === currentUserId);
          console.log('   !!e.documentId?', !!e?.documentId);
          
          // Additional debug: check if they're "equal" in other ways
          if (e?.userId && currentUserId) {
            console.log('   String comparison:', String(e.userId) === String(currentUserId));
            console.log('   Trimmed comparison:', e.userId.trim() === currentUserId.trim());
          }
          
          const isValid = e && e.userId === currentUserId && !!e.documentId;
          console.log('   → FINAL RESULT:', isValid);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          return isValid;
        }),
        tap((e) => console.log('✅ Collaborator REMOVED - triggering refresh, docId:', e.documentId))
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          console.log('🔄 Files list refresh triggered via RxJS');
          this.loadUserDocuments();
        },
        error: (err) => {
          console.error('❌ Error in merge subscription:', err);
        }
      });

      effect(() => {
      const refreshCount = this.docService.refresh$();
      if (refreshCount > 0) {
        console.log('🔄 Document service triggered refresh (count:', refreshCount, ')');
        this.loadUserDocuments();
      }
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    await this.loadUserDocuments();
  }

  // =====================================================================================
  // DOCUMENT LOADING
  // =====================================================================================
  async loadUserDocuments(): Promise<void> {
    console.log('📂 Loading user documents...');
    this.isLoading.set(true);

    try {
      const docs = await lastValueFrom(
        this.docService.getUserDocuments(this.currentFolderId())
      );

      this.documents.set(docs);

      const ownershipChecks = docs.map((item) =>
        firstValueFrom(
          this.docService
            .checkOwnership(item._id)
            .pipe(takeUntilDestroyed(this.destroyRef))
        ).then((res) => {
          item.isOwner = res.isOwner;
        })
      );

      await Promise.all(ownershipChecks);
      this.documents.update((d) => [...d]);
      
      console.log('✅ Loaded', docs.length, 'documents');
    } catch (err) {
      console.error('❌ Error loading documents:', err);
      this.documents.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  // =====================================================================================
  // FOLDER & FILE CREATION
  // =====================================================================================

  async createNewFolder(): Promise<void> {
    const dialogRef = this.dialog.open(FileDialogComponent, {
      data: {
        title: 'Create New Folder',
        placeholder: 'Folder name',
        defaultValue: 'New Folder',
        confirmText: 'Create'
      }
    });

    let folderName = await firstValueFrom(dialogRef.afterClosed());

    if (!folderName) return;

    // Check for duplicate folder names
    folderName = this.getUniqueFolderName(folderName);

    try {
      this.isLoading.set(true);
      await lastValueFrom(
        this.docService.createFolder({
          title: folderName,
          parentFolderId: this.currentFolderId()
        })
      );
      await this.loadUserDocuments();
    } finally {
      this.isLoading.set(false);
    }
  }

  private getUniqueFolderName(folderName: string): string {
  const currentFolders = this.folders().map(f => f.title);
  
  if (!currentFolders.includes(folderName)) {
    return folderName;
  }

  let counter = 1;
  let newFolderName: string;
  
  do {
    newFolderName = `${folderName} (${counter})`;
    counter++;
  } while (currentFolders.includes(newFolderName));

  return newFolderName;
}

  async createNewFile(): Promise<void> {
    const dialogRef = this.dialog.open(FileDialogComponent, {
      data: {
        title: 'Create New File',
        placeholder: 'File name',
        defaultValue: 'Untitled Document',
        confirmText: 'Create'
      }
    });

    let title = await firstValueFrom(dialogRef.afterClosed());
    if (!title) return;

    title = title.trim();

    const hasExtension =
      title.includes('.') &&
      title.split('.').pop()?.trim() !== '';

    if (!hasExtension) {
      title = `${title}.txt`;
    }

    // Check for duplicates and generate unique name
    title = this.getUniqueFileName(title);

    try {
      this.isLoading.set(true);

      // Create document
      const doc = await lastValueFrom(
        this.docService.createDocument({
          title,
          content: '',
          parentFolderId: this.currentFolderId()
        })
      );

      console.log('[Files] Created document:', doc._id, 'S3 key:', doc.s3Key);

  
      await this.waitForDocumentReady(doc._id);

      await this.loadUserDocuments();

      this.fileSelected.emit({
        _id: doc._id,
        title: doc.title,
        content: ''
      });

      console.log('[Files] File ready and emitted:', doc._id);
    } catch (error) {
      console.error('[Files] Error creating file:', error);
      this.notification.error('Failed to create file');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Add this helper method
  private getUniqueFileName(fileName: string): string {
    const currentFiles = this.files().map(f => f.title);
    
    if (!currentFiles.includes(fileName)) {
      return fileName;
    }

    // Split filename and extension
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

    // Find the next available number
    let counter = 1;
    let newFileName: string;
    
    do {
      newFileName = `${name} (${counter})${ext}`;
      counter++;
    } while (currentFiles.includes(newFileName));

    return newFileName;
  }

  private async waitForDocumentReady(docId: string, maxRetries = 5): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Verify document exists and has S3 key
        const doc = await firstValueFrom(
          this.docService.getDocumentById(docId)
        );
        
        if (doc.s3Key && doc.contentUrl) {
          console.log('[Files] Document ready:', docId);
          return;
        }
        
        console.log(`[Files] Waiting for document ${docId} (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    throw new Error('Document not ready after retries');
  }


  // =====================================================================================
  // ACTIONS (rename, delete, open)
  // =====================================================================================

  async renameItem(item: Document): Promise<void> {
    const dialogRef = this.dialog.open(FileDialogComponent, {
      data: {
        title: `Rename ${item.type}`,
        placeholder: 'New name',
        defaultValue: item.title,
        confirmText: 'Rename'
      }
    });

    const newTitle = await firstValueFrom(dialogRef.afterClosed());
    if (!newTitle || newTitle === item.title) return;

    try {
      await firstValueFrom(
        this.docService.renameItem(item._id, { title: newTitle })
      );

      this.documents.update((docs) =>
        docs.map((d) => (d._id === item._id ? { ...d, title: newTitle } : d))
      );

      if (item.type === 'file') {
        this.fileRenamed.emit({
          _id: item._id,
          newTitle
        });
      }
    } catch {
      this.notification.error('Rename failed');

    }
  }


  async deleteItem(item: Document): Promise<void> {
    try {
      await firstValueFrom(this.docService.deleteItem(item._id));
      this.documents.update((docs) => docs.filter((d) => d._id !== item._id));

      if (item.type === 'file') this.fileDeleted.emit(item._id);
    } catch (err) {
      this.notification.error('Failed to delete');
    }
  }

  openFile(item: Document): void {
    this.fileSelected.emit({ _id: item._id, title: item.title });
  }

  // =====================================================================================
  // FOLDER NAVIGATION
  // =====================================================================================

  enterFolder(folder: Document): void {
    this.currentFolderId.set(folder._id);
    this.breadcrumbs.update((b) => [...b, folder]);
    this.loadUserDocuments();
  }

  goUp(): void {
    const crumbs = this.breadcrumbs();
    if (!crumbs.length) return;

    this.breadcrumbs.update((b) => b.slice(0, -1));
    const newCrumbs = this.breadcrumbs();

    const newFolderId =
      newCrumbs.length > 0 ? newCrumbs[newCrumbs.length - 1]._id : null;

    this.currentFolderId.set(newFolderId);
    this.loadUserDocuments();
  }

  navigateToCrumb(crumb: Document): void {
    const crumbs = this.breadcrumbs();
    const idx = crumbs.findIndex((b) => b._id === crumb._id);
    if (idx === -1) return;

    this.breadcrumbs.set(crumbs.slice(0, idx + 1));
    this.currentFolderId.set(crumb._id);
    this.loadUserDocuments();
  }

  // =====================================================================================
  // FILE/FOLDER SHARING
  // =====================================================================================

  addCollaboratorForFile(item: Document): void {
    this.addCollaboratorService
      .openShareDialog(item, 'file')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res) this.docService.triggerRefresh();
      });
  }

  addCollaboratorForFolder(item: Document): void {
    this.addCollaboratorService
      .openShareDialog(item, 'folder')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res) this.docService.triggerRefresh();
      });
  }

  // =====================================================================================
  // LOCAL FILE / FOLDER UPLOAD
  // =====================================================================================

  private readFileContent(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = (e) => res(e.target?.result as string);
      reader.onerror = (e) => rej(e);
      reader.readAsText(file);
    });
  }

  async onLocalFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      const maxSize = 100 * 1024 * 1024; // 100 MB
      if (file.size > maxSize) {
        this.notification.error(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds limit`);
        input.value = '';
        return;
      }

      try {
        const content = await this.readFileContent(file);
        
        const newDoc = await firstValueFrom(
          this.docService.createDocument({
            title: file.name,
            content: content,
            parentFolderId: this.currentFolderId()
          })
        );
        
        this.documents.update(docs => [...docs, newDoc]);
        
        this.fileSelected.emit({
          _id: newDoc._id,
          title: newDoc.title
        });
        
        console.log(`✓ Local file "${file.name}" uploaded successfully`);
      } catch (err) {
        console.error('✗ Error uploading local file:', err);
        
        if ((err as any).status === 413) {
        const errorData = (err as any).error;
        if (errorData?.usedMB && errorData?.limitMB) {
          this.notification.error(
            `Storage limit exceeded. Used: ${errorData.usedMB} MB / ${errorData.limitMB} MB. Please delete some files.`
          );
        } else {
          this.notification.error('Storage limit exceeded. Please delete some files.');
        }
      } else {
        this.notification.error('Failed to upload file');
      }
      }
    }
    
    input.value = '';
  }

  async onLocalFolderSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (files && files.length > 0) {
      let totalSize = 0;
      for (let i = 0; i < files.length; i++) {
        totalSize += files[i].size;
      }
      
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      console.log(`📦 Total folder size: ${totalSizeMB} MB (${files.length} files)`);
      
      const maxSize = 100 * 1024 * 1024; // 100 MB
      if (totalSize > maxSize) {
        this.notification.error(`Folder size (${totalSizeMB} MB) exceeds 100 MB limit`);
        input.value = '';
        return;
      }
      
      this.isLoading.set(true);
      try {
        const firstFile = files[0] as any;
        const rootFolderName = firstFile.webkitRelativePath?.split('/')[0] || 'Uploaded Folder';
        
        const rootFolder = await firstValueFrom(
          this.docService.createFolder({
            title: rootFolderName,
            parentFolderId: this.currentFolderId()
          })
        );
        
        console.log(`✓ Created root folder: ${rootFolderName}`);
        
        const folderStructure = this.buildFolderStructure(files);
        await this.uploadFolderStructure(folderStructure, rootFolder._id, rootFolderName);
        
        await this.loadUserDocuments();
        
        console.log(`✓ Folder uploaded successfully`);
      } catch (err) {
        console.error('✗ Error uploading folder:', err);
        
        if ((err as any).status === 413) {
          const errorData = (err as any).error;
          if (errorData?.usedMB && errorData?.limitMB) {
            this.notification.error(
              `Storage limit exceeded during upload. Used: ${errorData.usedMB} MB / ${errorData.limitMB} MB`
            );
          } else {
            this.notification.error('Storage limit exceeded. Unable to upload entire folder.');
          }
        } else {
          this.notification.error('Failed to upload folder: ' + (err as any).message);
        }
        await this.loadUserDocuments();
      } finally {
        this.isLoading.set(false);
      }
    }
    
    input.value = '';
  }

  private buildFolderStructure(files: FileList): Map<string, File[]> {
    const structure = new Map<string, File[]>();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = (file as any).webkitRelativePath || file.name;
      const pathParts = path.split('/');
      const relativePath = pathParts.slice(1);
      const folderPath = relativePath.slice(0, -1).join('/');
      
      if (!structure.has(folderPath)) {
        structure.set(folderPath, []);
      }
      structure.get(folderPath)!.push(file);
    }
    
    return structure;
  }

  private async uploadFolderStructure(
    structure: Map<string, File[]>, 
    rootFolderId: string,
    rootFolderName: string
  ): Promise<void> {
    const folderMap = new Map<string, string>();
    folderMap.set('', rootFolderId);
    
    const sortedPaths = Array.from(structure.keys()).sort();
    
    for (const folderPath of sortedPaths) {
      const files = structure.get(folderPath)!;
      const pathParts = folderPath.split('/').filter(p => p);
      
      let currentPath = '';
      let currentParentId = rootFolderId;
      
      for (const folderName of pathParts) {
        currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        
        if (!folderMap.has(currentPath)) {
          try {
            const folder = await firstValueFrom(
              this.docService.createFolder({
                title: folderName,
                parentFolderId: currentParentId
              })
            );
            folderMap.set(currentPath, folder._id);
            currentParentId = folder._id;
            console.log(`✓ Created folder: ${currentPath}`);
          } catch (err) {
            console.error(`✗ Error creating folder ${currentPath}:`, err);
            throw err;
          }
        } else {
          currentParentId = folderMap.get(currentPath)!;
        }
      }
      
      for (const file of files) {
        try {
          const content = await this.readFileContent(file);
          await firstValueFrom(
            this.docService.createDocument({
              title: file.name,
              content: content,
              parentFolderId: currentParentId,
              type: 'file'
            })
          );
          console.log(`✓ Uploaded file: ${folderPath}/${file.name}`);
        } catch (err) {
          console.error(`✗ Error uploading file ${file.name}:`, err);
          throw err;
        }
      }
    }
  }
}