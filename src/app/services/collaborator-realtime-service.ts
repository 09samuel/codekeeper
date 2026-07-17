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
      return;
    }

    this.ws = new WebSocket(`${environment.WS_BASE_URL}/collab-global?token=${token}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleCollabEvent(msg);
      } catch (e) {
        console.error('❌ Invalid message', e);
      }
    };

    this.ws.onerror = (err) => {
      console.error('❌ Collaborator WS error:', err);
    };

    this.ws.onclose = (event) => {
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;

        setTimeout(() => {
          this.connectGlobal(token);
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };
  }

  handleCollabEvent(msg: any) {
    switch (msg.type) {
      case 'collaborator-added':
        this.store.add(msg.payload, msg.docId);
        this.notification.success('You have been added as a collaborator to a document');
        break;

      case 'collaborator-removed':
        this.store.remove(msg.payload._id, msg.payload.documentId);
        this.notification.success('You have been removed from a document');
        break;

      case 'collaborator-permission-updated':
        this.store.updatePermission(msg.payload._id, msg.payload.permission, msg.payload.documentId);
        this.showPermissionChangeNotification(msg.payload);
        break;

      case 'document-created':
        // Trigger files list refresh
        this.docService.triggerRefresh();
        break;

      case 'document-renamed':
        // Trigger files list refresh
        this.docService.triggerRefresh();
        break;

      case 'document-deleted':
        // Trigger files list refresh
        this.docService.triggerRefresh();
        break;

      case 'storage-quota-exceeded': {
        const used = msg.payload?.usedMB ?? msg.payload?.used ?? 'unknown';
        const limit = msg.payload?.limitMB ?? msg.payload?.limit ?? 'unknown';

        this.notification.error(
          `Storage limit exceeded. Used: ${used} MB / ${limit} MB. ` +
          'Please delete some files or folders to free up space.'
        );
        break;
      }

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
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }
}
