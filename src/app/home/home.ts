import { Component, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Editor } from '../editor/editor';
import { Files } from "../files/files";
import {Ai} from "../ai/ai";
import { AuthService } from '../services/auth-service';
import { Router } from '@angular/router';
import { EditorTab, TabService } from '../services/tab-service';
import { filter, Subscription } from 'rxjs';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { CodeRunner } from "../code-runner/code-runner";
import { CollaboratorStoreService } from '../services/collaborator-store-service';
import { CollaboratorRealtimeService } from '../services/collaborator-realtime-service';
import { AddCollaboratorService } from '../services/add-collaborator-service';
import { Observable } from 'rxjs';
import { NotificationService } from '../services/notification-service';
import { environment } from '../../environments/environment';
import { RuntimeService } from '../runtime-service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Editor, MatIconModule, Files, Ai, CodeRunner],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],  
})
export class Home implements OnDestroy {
  @ViewChild(Editor) editorComponent?: Editor;
  
  tabs: EditorTab[] = [];
  activeTab: EditorTab | null = null;

  activeUsers: Array<{id: string, name: string, avatar: string}> = [];

  collaborators$!: Observable<any[]>;

  currentUserPermission: 'view' | 'edit' | 'owner' = 'view';

  // Yjs properties - single instance managed here
  private ydoc: Y.Doc | null = null;
  private wsProvider: WebsocketProvider | null = null;
  private currentDocumentId: string | null = null;
  public documentOwner: any = null;
  
  private currentUser = {
    name: 'User-' + Math.floor(Math.random() * 1000),
    avatar: '',
    color: '#' + Math.floor(Math.random()*16777215).toString(16)
  };
  
  private tabSubscription: Subscription;
  private collaboratorSubscription?: Subscription;
  private awarenessChangeHandler: any = null;
  private currentUserId: string = '';
  isEditorLoading = false;

  // Mobile responsive properties
  isMobileView = false;

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private tabService: TabService,
    private collabRealtime: CollaboratorRealtimeService,
    private collaboratorStore: CollaboratorStoreService,
    private addCollaboratorService: AddCollaboratorService,
    private notification: NotificationService,
    private runtimeService: RuntimeService,
    private dialog: MatDialog  
  ) {
    this.collaborators$ = this.collaboratorStore.collaborators$;

    // Subscribe to tab changes
    this.tabSubscription = this.tabService.tabs$.subscribe(tabs => {
      this.tabs = tabs;
      this.activeTab = tabs.find(t => t.isActive) || null;
    });
  }

  ngOnInit() {
    const token = localStorage.getItem('accessToken')!;
    if (token) {
      // Connect global WebSocket once on init and keep it connected
      this.collabRealtime.connectGlobal(token);
    }
    this.subscribeToCollaboratorRemovals();
    this.currentUserId = this.authService.getCurrentUserId() || '';
    this.runtimeService.loadRuntimes();
    
    // Initialize viewport check
    this.checkViewport();
  }

  ngOnDestroy() {
    // Clean up subscription
    if (this.tabSubscription) {
      this.tabSubscription.unsubscribe();
    }

    // Disconnect Yjs
    this.disconnectYjs();
    
    // Only disconnect global WebSocket on component destroy (logout)
    this.collabRealtime.disconnect();
  }

  // Listen to window resize events
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkViewport();
  }

  // Check if mobile viewport
  checkViewport() {
    const wasMobile = this.isMobileView;
    this.isMobileView = window.innerWidth <= 768;
    
    // Auto-collapse panel on mobile by default (only on first load or when switching to mobile)
    if (this.isMobileView && !wasMobile) {
      this.isPanelCollapsed = true;
    }
  }

  disconnectYjs() {
    // Remove awareness listener
    if (this.wsProvider && this.awarenessChangeHandler) {
      this.wsProvider.awareness.off('change', this.awarenessChangeHandler);
      this.awarenessChangeHandler = null;
    }

    if (this.wsProvider) {
      this.wsProvider.disconnect();
      this.wsProvider.destroy();
      this.wsProvider = null;
    }
    
    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }

    this.currentDocumentId = null;
    this.activeUsers = [];
  }

  onFileSelected(file: { _id: string; title: string } | string) {
    const documentId = typeof file === 'string' ? file : file._id;
    const title = typeof file === 'string' ? 'Untitled' : (file.title || 'Untitled');

    this.tabService.openTab(documentId, title);
    
    if (this.currentDocumentId !== documentId) {
      this.connectToDocument(documentId);
    }
  }

  selectTab(tabId: string) {
    const previousActiveTab = this.activeTab;
    this.tabService.setActiveTab(tabId);
    
    const newActiveTab = this.tabs.find(t => t.id === tabId);
    
    if (newActiveTab && previousActiveTab?.documentId !== newActiveTab.documentId) {
      this.connectToDocument(newActiveTab.documentId);
    }
  }

  closeTab(tabId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    
    const closingTab = this.tabs.find(t => t.id === tabId);
    const wasActiveTab = this.activeTab?.id === tabId;

    this.tabService.closeTab(tabId);

    if (wasActiveTab) {
      this.disconnectYjs();
      
      setTimeout(() => {
        const newActiveTab = this.tabs.find(t => t.isActive);
        if (newActiveTab && newActiveTab.documentId !== closingTab?.documentId) {
          this.connectToDocument(newActiveTab.documentId);
        }
      }, 0);
    }
  }

  icons = [
    { name: 'files', icon: 'insert_drive_file' },
    { name: 'run', icon: 'play_arrow' },
    { name: 'ai', icon: 'psychology' },
    { name: 'logout', icon: 'logout' }
  ];

  selectedPanel: string = this.icons[0].name;
  isPanelCollapsed: boolean = false;
  
  selectPanel(panelName: string) {
    if (this.isMobileView) {
      // Mobile: Toggle panel on same icon tap
      if (this.selectedPanel === panelName && !this.isPanelCollapsed) {
        this.isPanelCollapsed = true;
      } else {
        this.selectedPanel = panelName;
        this.isPanelCollapsed = false;
      }
    } else {
      // Desktop: Original behavior
      if (this.selectedPanel === panelName && !this.isPanelCollapsed) {
        this.isPanelCollapsed = true;
      } else {
        this.selectedPanel = panelName;
        this.isPanelCollapsed = false;
      }
    }
  }

  // Close panel when clicking backdrop (mobile only)
  closePanelOnMobile() {
    if (this.isMobileView) {
      this.isPanelCollapsed = true;
    }
  }

  onFileDeleted(documentId: string) {
    const tabToClose = this.tabs.find(tab => tab.documentId === documentId);
    if (tabToClose) {
      this.tabService.closeTab(tabToClose.id);
      
      if (this.currentDocumentId === documentId) {
        this.disconnectYjs();
      }
    }
  }

  onFileRenamed(event: { _id: string; newTitle: string }) {
    this.tabService.renameTab(event._id, event.newTitle);
  }

  connectToDocument(documentId: string) {
    this.isEditorLoading = true; 
    
    this.disconnectYjs();
    
    this.ydoc = new Y.Doc();
    this.currentDocumentId = documentId;
    
    const accessToken = localStorage.getItem('accessToken') || '';
    
    if (!accessToken) {
      console.error('No access token found. Redirecting to login...');
      this.router.navigate(['/login']);
      return;
    }

    this.wsProvider = new WebsocketProvider(
       environment.WS_BASE_URL,
      `doc-${documentId}`,
      this.ydoc,
      { 
        connect: false,
        params: { 
          token: accessToken
        }
      }
    );
    
    // Load initial collaborators into store
    this.addCollaboratorService.loadCollaborators(documentId).subscribe({
      next: (response) => {
        this.collaboratorStore.setCurrentDocument(documentId);
        this.collaboratorStore.setAll(response.collaborators, documentId);
        this.documentOwner = response.owner; 
      },
      error: (error) => {
        console.error('Failed to load initial collaborators:', error);
      }
    });

    const currentUser = localStorage.getItem('currentUser') 
      ? JSON.parse(localStorage.getItem('currentUser')!) 
      : null;  
    
    this.wsProvider.awareness.setLocalStateField('user', {
      id: currentUser?._id || 'unknown',
      name: currentUser?.name || currentUser?.username || 'Anonymous',
      avatar: currentUser?.avatar || this.generateAvatarUrl(currentUser?.name || 'User')
    });


    this.wsProvider.on('status', ({ status }: { status: string }) => {
      if (status === 'connected') {
      } else if (status === 'disconnected') {
      }
    });

    if (!this.wsProvider) return;

    this.wsProvider.on('connection-close', async (event, provider) => {
      if (event?.code === 1008 || event?.code === 4401) {
        console.error('Authentication failed. Token may be invalid or expired.');
        this.wsProvider!.shouldConnect = false;

        const refreshed = await this.authService.refreshTokens();
        if (refreshed) {
          this.connectToDocument(documentId);
        } else {
          console.error('Token refresh failed, redirecting to login');
          this.router.navigate(['/login']);
        }
      }
    });

    this.wsProvider.on('connection-error', (error: Event) => {
      console.error('[WebSocket] Connection error:', error);
    });

    this.awarenessChangeHandler = this.handleAwarenessChange.bind(this);
    this.wsProvider.awareness.on('change', this.awarenessChangeHandler);
    
    this.wsProvider.connect();
    
    this.updateActiveUsers();
  }

  handleAwarenessChange(changes: {
    added: number[],
    updated: number[],
    removed: number[]
  }) {
    this.updateActiveUsers();
  }

  updateActiveUsers() {
    if (!this.wsProvider) return;
    
    const awareness = this.wsProvider.awareness;
    const states = Array.from(awareness.getStates().entries());
    
    this.activeUsers = states
      .filter(([clientId, state]) => {
        const isCurrentUser = clientId === awareness.clientID;
        const hasUserInfo = state['user'] && state['user'].name;
        return !isCurrentUser && hasUserInfo;
      })
      .map(([clientId, state]) => ({
        id: clientId.toString(),
        name: state['user'].name,
        avatar: state['user'].avatar || this.generateAvatarUrl(state['user'].name)
      }));
  }

  getRemainingUsersTooltip(): string {
    const remainingUsers = this.activeUsers.slice(3);
    return remainingUsers.map(user => user.name).join(', ');
  }

  get currentProvider(): WebsocketProvider | null {
    return this.wsProvider;
  }

  get currentYDoc(): Y.Doc | null {
    return this.ydoc;
  }

  generateAvatarUrl(name: string): string {
    const encodedName = encodeURIComponent(name);
    return `${environment.AVATAR_BASE_URL}/?name=${encodedName}&background=random&size=32`;
  }

  logout() {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Confirm Logout',
        message: 'Are you sure you want to logout?',
        confirmText: 'Logout',
        cancelText: 'Cancel',
        icon: 'logout',
        iconColor: 'red-400'
      },
      panelClass: 'custom-dialog-container',
      backdropClass: 'custom-dialog-backdrop',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(async (confirmed: boolean) => {
      if (confirmed) {
        // Disconnect Yjs
        this.disconnectYjs();
        
        // Explicitly disconnect global WebSocket on logout
        this.collabRealtime.disconnect();
        
        await this.authService.logout();
        this.router.navigate(['/login']);
      }
    });
  }

  getEditorContent(): string {
    if (this.editorComponent) {
      return this.editorComponent.getContent();
    }
    return '';
  }

  private subscribeToCollaboratorRemovals() {
    this.collaboratorStore.collaboratorRemoved$
      .pipe(filter(event => !!event))
      .subscribe(event => {
        const { userId: removedUserId, documentId } = event!;

        // If some other user was removed, do nothing.
        if (removedUserId !== this.currentUserId) {
          return;
        }

        // If the removed document is currently open → close it
        const openTab = this.tabs.find(t => t.documentId === documentId);
        if (openTab) {
          this.notification.error('Your access to a document was revoked. The tab will be closed.');
          this.tabService.closeTab(openTab.id);

          // Disconnect Yjs if it was the active one
          if (this.currentDocumentId === documentId) {
            this.disconnectYjs();
          }
        }
      });
  }

  onEditorInitialized() {
    this.isEditorLoading = false;
  }

  onEditorLoadError() {
    this.isEditorLoading = false;
    if (this.activeTab) {
      this.closeTab(this.activeTab.id); 
    }
    this.notification.error('Failed to load document content. Please try again.');
  }
}
