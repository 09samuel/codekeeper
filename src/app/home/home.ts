import { Component, OnDestroy, ViewChild } from '@angular/core';
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

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private tabService: TabService,
    private collabRealtime: CollaboratorRealtimeService,
    private collaboratorStore: CollaboratorStoreService,
    private addCollaboratorService: AddCollaboratorService,
    private notification: NotificationService
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
      console.log('🌐 Connecting global collaborator WebSocket...');
      this.collabRealtime.connectGlobal(token);
    }
    this.subscribeToCollaboratorRemovals();
    this.currentUserId = this.authService.getCurrentUserId() || '';
  }

  ngOnDestroy() {
    // Clean up subscription
    if (this.tabSubscription) {
      this.tabSubscription.unsubscribe();
    }

    // Disconnect Yjs
    this.disconnectYjs();
    
    // Only disconnect global WebSocket on component destroy (logout)
    console.log('🌐 Disconnecting global collaborator WebSocket...');
    this.collabRealtime.disconnect();
  }

  disconnectYjs() {
    console.log('🧹 Disconnecting Yjs (but keeping global collab WebSocket alive)');
    
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

  closeTab(event: Event, tabId: string) {
    event.stopPropagation();
    
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
    { name: 'chat', icon: 'chat_bubble' },
    { name: 'run', icon: 'play_arrow' },
    { name: 'ai', icon: 'psychology' },
    { name: 'draw', icon: 'draw' },
    { name: 'settings', icon: 'settings' },
    { name: 'logout', icon: 'logout' }
  ];

  selectedPanel: string = this.icons[0].name;
  isPanelCollapsed: boolean = false;
  
  selectPanel(panelName: string) {
    if (this.selectedPanel === panelName && !this.isPanelCollapsed) {
      this.isPanelCollapsed = true;
    } else {
      this.selectedPanel = panelName;
      this.isPanelCollapsed = false;
    }
  }

  onFileDeleted(documentId: string) {
    const tabToClose = this.tabs.find(tab => tab.documentId === documentId);
    if (tabToClose) {
      this.tabService.closeTab(tabToClose.id);
      console.log(`✓ Closed tab for deleted file ${documentId}`);
      
      if (this.currentDocumentId === documentId) {
        this.disconnectYjs();
      }
    }
  }

  onFileRenamed(event: { _id: string; newTitle: string }) {
    this.tabService.renameTab(event._id, event.newTitle);
    console.log(`✓ Updated tab title to "${event.newTitle}"`);
  }

  connectToDocument(documentId: string) {
    console.log(`Connecting to document: ${documentId}`);
    
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
      'ws://localhost:1234',
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
        console.log('✓ Loaded initial collaborators:', response.collaborators);
        console.log('✓ Document owner:', response.owner);
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

    console.log('Set my awareness state as:', this.wsProvider.awareness.getLocalState());

    this.wsProvider.on('status', ({ status }: { status: string }) => {
      console.log(`[WebSocket] Status: ${status}`);
      
      if (status === 'connected') {
        console.log('✓ Successfully connected to Yjs server');
      } else if (status === 'disconnected') {
        console.log('✗ Disconnected from Yjs server');
      }
    });

    if (!this.wsProvider) return;

    this.wsProvider.on('connection-close', async (event, provider) => {
      console.log('[WebSocket] Connection closed:', event?.code, event?.reason);

      if (event?.code === 1008 || event?.code === 4401) {
        console.error('Authentication failed. Token may be invalid or expired.');
        this.wsProvider!.shouldConnect = false;

        const refreshed = await this.authService.refreshTokens();
        if (refreshed) {
          console.log('Token refreshed, reconnecting...');
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
    if (changes.added.length > 0) {
      console.log('Users joined:', changes.added);
    }
    if (changes.updated.length > 0) {
      console.log('Users updated:', changes.updated);
    }
    if (changes.removed.length > 0) {
      console.log('Users left:', changes.removed);
    }
    
    this.updateActiveUsers();
  }

  updateActiveUsers() {
    if (!this.wsProvider) return;
    
    const awareness = this.wsProvider.awareness;
    const states = Array.from(awareness.getStates().entries());
    
    console.log('=== AWARENESS DEBUG ===');
    console.log('My client ID:', awareness.clientID);
    console.log('Total clients:', states.length);
    
    states.forEach(([clientId, state]) => {
      const isMe = clientId === awareness.clientID;
      console.log(`${isMe ? '→ ME ' : '  Other'} Client ${clientId}:`, state['user']?.name || 'No name');
    });
    
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
    
    console.log('Other active users to display:', this.activeUsers);
    console.log('=== END DEBUG ===');
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
    return `https://ui-avatars.com/api/?name=${encodedName}&background=random&size=32`;
  }

  async logout() {
    // Disconnect Yjs
    this.disconnectYjs();
    
    // Explicitly disconnect global WebSocket on logout
    console.log('🌐 Disconnecting global collaborator WebSocket on logout...');
    this.collabRealtime.disconnect();
    
    await this.authService.logout();
    this.router.navigate(['/login']);
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
        console.log('🏠 Home received collaboratorRemoved$ event:', event);

        const { userId: removedUserId, documentId } = event!;

        // If some other user was removed, do nothing.
        if (removedUserId !== this.currentUserId) {
          console.log('   → Different user removed, ignoring');
          return;
        }

        console.log('   → CURRENT USER was removed from document:', documentId);

        // If the removed document is currently open → close it
        const openTab = this.tabs.find(t => t.documentId === documentId);
        if (openTab) {
          console.log(`⚠️ You lost access to document ${documentId}. Closing tab.`);
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
    this.notification.error('Failed to load document content. Please try again.');
  }
}