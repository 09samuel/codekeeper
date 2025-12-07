import { Injectable } from '@angular/core';
import { CollaboratorStoreService } from './collaborator-store-service';
import { NotificationService } from './notification-service';
import { DocumentService } from './document-service';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class CollaboratorRealtimeService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  constructor(
    private store: CollaboratorStoreService,
    private notification: NotificationService,
    private docService: DocumentService
  ) {}

  connectGlobal(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('⚠️ Global WS already connected');
      return;
    }

    console.log('🔌 Connecting GLOBAL collaborator WebSocket…');

    this.ws = new WebSocket(`${environment.WS_BASE_URL}/collab-global?token=${token}`);

    this.ws.onopen = () => {
      console.log('✅ Global collaborator WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('📨 Global collab event:', msg.type, msg.payload);
        this.handleCollabEvent(msg);
      } catch (e) {
        console.error('❌ Invalid message', e);
      }
    };

    this.ws.onerror = (err) => {
      console.error('❌ Collaborator WS error:', err);
    };

    this.ws.onclose = (event) => {
      console.log('🔌 Global WS closed:', event.code, event.reason);

      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Reconnecting global WS (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
          this.connectGlobal(token);
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };
  }

  handleCollabEvent(msg: any) {
    console.log('🎯 handleCollabEvent called with type:', msg.type);
    
    switch (msg.type) {
      case 'collaborator-added':
        console.log('➕ WS EVENT: collaborator-added', msg.payload, msg.docId);
        
        this.store.add(msg.payload, msg.docId);
        this.notification.success('You have been added as a collaborator to a document');
        break;

      case 'collaborator-removed':
        console.log('➖ WS EVENT: collaborator-removed', msg.payload);
        this.store.remove(msg.payload._id, msg.payload.documentId);
        this.notification.success('You have been removed from a document');
        break;

      case 'collaborator-permission-updated':
        console.log('🔄 WS EVENT: collaborator-permission-updated', msg.payload);
        this.store.updatePermission(msg.payload._id, msg.payload.permission, msg.payload.documentId);
        this.showPermissionChangeNotification(msg.payload);
        break;

      case 'document-created':
        console.log('📄 WS EVENT: document-created', msg.payload);
        // Trigger files list refresh
        this.docService.triggerRefresh();
        break;

      case 'document-renamed':
        console.log('✏️ WS EVENT: document-renamed', msg.payload);
        // Trigger files list refresh
        this.docService.triggerRefresh();
        break;

      case 'document-deleted':
        console.log('🗑️ WS EVENT: document-deleted', msg.payload);
        // Trigger files list refresh
        this.docService.triggerRefresh();
        break;

      default:
        console.warn('⚠️ Unknown collab event:', msg.type);
    }
  }

  private showPermissionChangeNotification(payload: any) {
    if (payload.permission === 'edit') {
      this.notification.success('You now have edit access to this document');
    } else {
      this.notification.error('Your access has been changed to view-only');
    }
  }

  disconnect() {
    if (this.ws) {
      console.log('🔌 Disconnecting global collaborator WebSocket');
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }
}
