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
import { vsCodeDark } from '@fsegurai/codemirror-theme-vscode-dark'

const customFontTheme = EditorView.theme({
  "&": {
    fontSize: "0.75rem",
    fontFamily: '"YourGroteskFontName", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  ".cm-content": {
    fontSize: "0.75rem",
    fontFamily: '"YourGroteskFontName", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  ".cm-gutters": {
    fontSize: "0.75rem",
    fontFamily: '"YourGroteskFontName", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
});

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

    //  Subscribe to collaboratorRemoved$ with correct event structure
    this.removalSubscription = this.collaboratorStore.collaboratorRemoved$
      .subscribe(event => {
        if (!event || !event.documentId) {
          return;
        }

        // 1) If any collaborator removed for the open document -> refresh metadata
        if (event.documentId === this.documentId) {
          this.docService.getDocumentPermission(this.documentId).subscribe({
            next: (res) => {
              this.userPermission = (this.currentUserId === this.documentOwner?._id) ? 'edit' : res.permission;
              this.applyPermissionToEditor(this.userPermission);
            },
            error: (err) => console.error('❌ Error refreshing permission after removal:', err)
          });
        }

        // 2) If current user removed from this document -> close editor
        const shouldCloseEditor = event.userId === this.currentUserId && event.documentId === this.documentId;
        
        if (shouldCloseEditor) {
          this.cleanupEditor();
          window.location.href = '/home';
        }
      }, err => {
        console.error('❌ collaboratorRemoved$ subscription error in editor:', err);
      });

    if (this.documentId && this.provider && this.ydoc) {
      this.docService.getDocumentPermission(this.documentId).subscribe({
        next: async (res) => { 
          this.userPermission = res.permission;

          if (this.currentUserId === this.documentOwner?._id) {
            this.userPermission = 'edit';
          }
          
          // AWAIT editor initialization
          await this.initEditor().catch(err => {
            console.error('❌ Failed to initialize editor:', err);
          });

          // subscribe AFTER editor is ready
          this.subscribeToPermissionChanges();
        },
        error: async (err) => { 
          console.error('❌ Error fetching initial permission:', err);
          this.loadError.emit();
          this.cleanupEditor();
        }
      });
    }
  }


  ngOnChanges(changes: SimpleChanges) {
    if (changes['documentId'] && !changes['documentId'].firstChange) {
      this.cleanupEditor();
      this.unsubscribeFromPermissionChanges();
      
      if (this.documentId && this.provider && this.ydoc) {
        this.docService.getDocumentPermission(this.documentId).subscribe({
          next: async (res) => {  
            this.userPermission = res.permission;
            
            if (this.currentUserId === this.documentOwner?._id) {
              this.userPermission = 'edit';
            }

            await this.initEditor(); 
            this.subscribeToPermissionChanges();
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
    this.cleanupEditor();
    this.unsubscribeFromPermissionChanges();
    
    // Also unsubscribe from removal events
    if (this.removalSubscription) {
      this.removalSubscription.unsubscribe();
      this.removalSubscription = undefined;
    }
  }

  private subscribeToPermissionChanges() {
    if (!this.currentUserId) {
      console.warn('⚠️ Cannot subscribe to permissions: No current user ID found');
      return;
    }
    
    this.permissionSubscription = this.collaboratorStore
      .getUserPermission$(this.currentUserId, this.documentId)
      .subscribe({
        next: (permission) => {
          if (this.currentUserId === this.documentOwner?._id) {
            permission = 'edit';
          }
          
          if (this.userPermission !== permission) {
            this.userPermission = permission;
            this.applyPermissionToEditor(permission);
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
        this.showNotification('Editor is now read-only');
      } else {
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
    }
  }

  private showNotification(message: string) {
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

  

  private async initEditor(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ytext = this.ydoc.getText('codemirror');
      this.undoManager = new Y.UndoManager(this.ytext);

      const finish = () => {
        this.createEditor();
        this.initialized.emit();
        resolve(); // ✅ Resolve when editor is fully ready
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
                // Detect S3 XML error responses
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
                this.cleanupEditor();
                reject(err);
              });
          } else {
            finish();
          }
        },
        error: (err) => {
          console.error('❌ Error getting signed URL:', err);
          this.loadError.emit();
          this.cleanupEditor(); 
          reject(err);
        }
      });
    } else {
      finish();
    }
    });
}

  private createEditor() {
    if (!this.ytext || !this.undoManager) {
      console.error('Cannot create editor: ytext or undoManager is null');
      return;
    }

    const languageSupport = this.getLanguageFromFilename(this.title || '');

    const extensions: any[] = [
      basicSetup,
      vsCodeDark,
      customFontTheme,
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
  }

  setReadOnly(readOnly: boolean) {
    if (this.editorView) {
      this.userPermission = readOnly ? 'view' : 'edit';
      this.applyPermissionToEditor(this.userPermission);
    } else {
      console.error('❌ Cannot set read-only: editorView is null');
    }
  }
}