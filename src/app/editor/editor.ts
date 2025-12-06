import { Component, AfterViewInit, Input, OnChanges, SimpleChanges, OnDestroy, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import { WebsocketProvider } from 'y-websocket';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { DocumentService } from '../services/document-service';
import { CollaboratorStoreService } from '../services/collaborator-store-service';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { xml } from '@codemirror/lang-xml';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { php } from '@codemirror/lang-php';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth-service';
import { githubDark } from '@fsegurai/codemirror-theme-github-dark'


@Component({
  selector: 'app-editor',
  template: `<div #editorContainer class="h-full w-full"></div>`,
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }
  `]
})
export class Editor implements AfterViewInit, OnChanges, OnDestroy {
  @Input() documentId!: string;
  @Input() provider!: WebsocketProvider;
  @Input() ydoc!: Y.Doc;
  @Input() content?: string;
  @Input() title?: string;
  @Input() documentOwner!: { _id: string };
  
  @Output() initialized = new EventEmitter<void>();
  @Output() loadError = new EventEmitter<void>();

  userPermission: 'edit' | 'view' = 'view';
  
  @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;

  public editorView: EditorView | null = null;
  private ytext: Y.Text | null = null;
  private undoManager: Y.UndoManager | null = null;
  private languageCompartment = new Compartment();
  private readOnlyCompartment = new Compartment();
  
  private permissionSubscription?: Subscription;
  private removalSubscription?: Subscription;
  private currentUserId: string | null = null;

  constructor(
    private docService: DocumentService,
    private collaboratorStore: CollaboratorStoreService,
    private authService: AuthService 
  ) {}

  getContent(): string {
    if (this.ytext) {
      return this.ytext.toString();
    }
    return '';
  }

  ngAfterViewInit() {
    this.currentUserId = this.authService.getCurrentUserId();
    console.log('👤 Current user ID:', this.currentUserId);

    //  Subscribe to collaboratorRemoved$ with correct event structure
    this.removalSubscription = this.collaboratorStore.collaboratorRemoved$
      .subscribe(event => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🧾 EDITOR RECEIVED collaboratorRemoved$ event');
        console.log('   Event:', event);
        console.log('   event._id:', event?.userId);
        console.log('   event.documentId:', event?.documentId);
        console.log('   Current editor docId:', this.documentId);
        console.log('   Current userId:', this.currentUserId);
        console.log('   Document owner:', this.documentOwner?._id);

        if (!event || !event.documentId) {
          console.log('⚠️ collaboratorRemoved$ event missing documentId or is falsy');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          return;
        }

        // 1) If any collaborator removed for the open document -> refresh metadata
        console.log('🔍 Checking if event is for this document...');
        console.log('   event.documentId === this.documentId?', event.documentId === this.documentId);
        
        if (event.documentId === this.documentId) {
          console.log('✓ YES - This is for the currently open document');
          console.log('🔄 Refreshing permissions/collabs for this document');
          
          this.docService.getDocumentPermission(this.documentId).subscribe({
            next: (res) => {
              console.log('🔁 Refreshed permission from backend:', res.permission);
              this.userPermission = (this.currentUserId === this.documentOwner?._id) ? 'edit' : res.permission;
              this.applyPermissionToEditor(this.userPermission);
            },
            error: (err) => console.error('❌ Error refreshing permission after removal:', err)
          });
        }

        // 2) If current user removed from this document -> close editor
        console.log('🔍 Checking if CURRENT USER was removed...');
        console.log('   event._id:', event.userId);
        console.log('   currentUserId:', this.currentUserId);
        console.log('   event._id === currentUserId?', event.userId === this.currentUserId);
        console.log('   event.documentId === this.documentId?', event.documentId === this.documentId);
        
        const shouldCloseEditor = event.userId === this.currentUserId && event.documentId === this.documentId;
        console.log('   → Should close editor?', shouldCloseEditor);
        
        if (shouldCloseEditor) {
          console.log('⛔⛔⛔ CURRENT USER REMOVED FROM THIS DOCUMENT ⛔⛔⛔');
          console.log('   Cleaning up editor...');
          this.cleanupEditor();
          console.log('   Redirecting to /home...');
          window.location.href = '/home';
        } else {
          console.log('ℹ️ Not closing editor (user not removed or different document)');
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }, err => {
        console.error('❌ collaboratorRemoved$ subscription error in editor:', err);
      });

    if (this.documentId && this.provider && this.ydoc) {
      this.docService.getDocumentPermission(this.documentId).subscribe({
        next: (res) => {
          console.log('📋 Initial permission from backend:', res.permission);
          this.userPermission = res.permission;

          if (this.currentUserId === this.documentOwner?._id) {
            this.userPermission = 'edit';
          }
          
          setTimeout(() => {
            this.initEditor();
            this.subscribeToPermissionChanges();
          }, 0);
        },
        error: (err) => {
          console.error('❌ Error fetching initial permission:', err);
          this.userPermission = 'view';
          
          setTimeout(() => {
            this.initEditor();
            this.subscribeToPermissionChanges();
          }, 0);
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['documentId'] && !changes['documentId'].firstChange) {
      console.log('📄 Document changed, cleaning up and re-initializing...');
      
      this.cleanupEditor();
      this.unsubscribeFromPermissionChanges();
      
      if (this.documentId && this.provider && this.ydoc) {
        this.docService.getDocumentPermission(this.documentId).subscribe({
          next: (res) => {
            this.userPermission = res.permission;

            if (this.currentUserId === this.documentOwner?._id) {
              this.userPermission = 'edit';
            }

            setTimeout(() => {
              this.initEditor();
              this.subscribeToPermissionChanges();
            }, 0);
          },
          error: (err) => {
            console.error('❌ Error fetching permission:', err);
            this.userPermission = 'view';
            setTimeout(() => {
              this.initEditor();
              this.subscribeToPermissionChanges();
            }, 0);
          }
        });
      }
    }

    if (changes['title'] && !changes['title'].firstChange && this.editorView) {
      this.updateLanguage(this.title || '');
    }
  }

  ngOnDestroy() {
    console.log('🧹 Editor component destroying, cleaning up...');
    this.cleanupEditor();
    this.unsubscribeFromPermissionChanges();
    
    // Also unsubscribe from removal events
    if (this.removalSubscription) {
      this.removalSubscription.unsubscribe();
      this.removalSubscription = undefined;
      console.log('🔕 Unsubscribed from collaboratorRemoved$');
    }
  }

  private subscribeToPermissionChanges() {
    if (!this.currentUserId) {
      console.warn('⚠️ Cannot subscribe to permissions: No current user ID found');
      return;
    }

    console.log('🔔 Subscribing to permission changes for user:', this.currentUserId);
    
    this.permissionSubscription = this.collaboratorStore
      .getUserPermission$(this.currentUserId, this.documentId)
      .subscribe({
        next: (permission) => {
          console.log('🔄 Real-time permission update received:', permission);
          console.log('   Current permission:', this.userPermission);
          console.log('   New permission:', permission);

          if (this.currentUserId === this.documentOwner?._id) {
            permission = 'edit';
          }
          
          if (this.userPermission !== permission) {
            console.log('✨ Permission changed! Updating editor...');
            this.userPermission = permission;
            this.applyPermissionToEditor(permission);
          } else {
            console.log('ℹ️ Permission unchanged, no action needed');
          }
        },
        error: (err) => {
          console.error('❌ Error in permission subscription:', err);
        }
      });
  }

  private applyPermissionToEditor(permission: 'edit' | 'view') {
    if (!this.editorView) {
      console.warn('⚠️ Cannot apply permission: Editor view not initialized yet');
      return;
    }

    const isReadOnly = permission === 'view';
    
    try {
      this.editorView.dispatch({
        effects: this.readOnlyCompartment.reconfigure(
          EditorState.readOnly.of(isReadOnly)
        )
      });
      
      if (isReadOnly) {
        console.log('🔒 ✅ Editor LOCKED (view-only mode)');
        this.showNotification('Editor is now read-only');
      } else {
        console.log('🔓 ✅ Editor UNLOCKED (edit mode)');
        this.showNotification('You now have edit access');
      }
    } catch (error) {
      console.error('❌ Error applying permission to editor:', error);
    }
  }

  private unsubscribeFromPermissionChanges() {
    if (this.permissionSubscription) {
      this.permissionSubscription.unsubscribe();
      this.permissionSubscription = undefined;
      console.log('🔕 Unsubscribed from permission changes');
    }
  }

  private showNotification(message: string) {
    console.log('📢 Notification:', message);
  }

  private getLanguageFromFilename(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return javascript();
      case 'ts':
      case 'tsx':
        return javascript({ typescript: true });
      case 'py':
        return python();
      case 'java':
        return java();
      case 'html':
      case 'htm':
        return html();
      case 'css':
        return css();
      case 'json':
        return json();
      case 'md':
      case 'markdown':
        return markdown();
      case 'xml':
      case 'svg':
        return xml();
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'h':
      case 'hpp':
        return cpp();
      case 'rs':
        return rust();
      case 'sql':
        return sql();
      case 'php':
        return php();
      case 'txt':
      default:
        return [];
    }
  }

  private updateLanguage(title: string) {
    if (!this.editorView) return;
    
    const languageSupport = this.getLanguageFromFilename(title);
    this.editorView.dispatch({
      effects: this.languageCompartment.reconfigure(languageSupport)
    });
  }

  private cleanupEditor() {
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
    
    this.ytext = null;
    this.undoManager = null;
  }

 private initEditor() {
  this.ytext = this.ydoc.getText('codemirror');
  this.undoManager = new Y.UndoManager(this.ytext);

  const finish = () => {
    this.createEditor();
    this.initialized.emit(); 
  };

  if (this.content && this.ytext.length === 0) {
    this.ytext.insert(0, this.content);
    finish();
  } else if (this.ytext.length === 0) {
    this.docService.getDocumentSignedUrl(this.documentId).subscribe({
      next: (res) => {
        if (res.url) {
          fetch(res.url)
            .then(r => {
              if (!r.ok) {
                throw new Error(`S3 fetch failed: ${r.status} ${r.statusText}`);
              }
              return r.text();
            })
            .then(content => {
              // 🔥 ADD THIS CHECK - Detect S3 XML error responses
              if (content.trim().startsWith('<?xml') && content.includes('<Error>')) {
                console.error('❌ S3 returned an error response:', content);
                throw new Error('File not found in S3');
              }

              const setInitialContent = () => {
                if (this.ytext!.length === 0 && content) {
                  this.ytext!.insert(0, content);
                }
                finish();
              };

              if (this.provider.synced) {
                setInitialContent();
              } else {
                this.provider.once('sync', setInitialContent);
              }
            })
            .catch(err => {
              console.error('❌ Error loading document:', err);
              this.showNotification('Document file not found. Starting with empty document.');
              this.loadError.emit();
              finish(); // Create empty editor
            });
        } else {
          finish();
        }
      },
      error: (err) => {
        console.error('❌ Error getting signed URL:', err);
        this.loadError.emit();
        finish();
      }
    });
  } else {
    finish();
  }
}

  private createEditor() {
    if (!this.ytext || !this.undoManager) {
      console.error('Cannot create editor: ytext or undoManager is null');
      return;
    }

    const languageSupport = this.getLanguageFromFilename(this.title || '');

    const extensions: any[] = [
      basicSetup,
      githubDark,
      yCollab(this.ytext, this.provider.awareness, { undoManager: this.undoManager })
    ];

    if (Array.isArray(languageSupport)) {
      extensions.push(this.languageCompartment.of(languageSupport));
    } else if (languageSupport) {
      extensions.push(this.languageCompartment.of(languageSupport));
    } else {
      extensions.push(this.languageCompartment.of([]));
    }

    extensions.push(
      this.readOnlyCompartment.of(EditorState.readOnly.of(this.userPermission === 'view'))
    );

    const state = EditorState.create({
      doc: this.ytext.toString(),
      extensions
    });

    this.editorView = new EditorView({
      state,
      parent: this.editorContainer.nativeElement
    });
    
    console.log(`✅ Editor initialized in ${this.userPermission} mode`);
  }

  setReadOnly(readOnly: boolean) {
    console.log('📝 Manual setReadOnly called with:', readOnly);
    
    if (this.editorView) {
      this.userPermission = readOnly ? 'view' : 'edit';
      this.applyPermissionToEditor(this.userPermission);
    } else {
      console.error('❌ Cannot set read-only: editorView is null');
    }
  }
}