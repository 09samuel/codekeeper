import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface EditorTab {
  id: string;
  documentId: string;
  title: string;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TabService {
  private tabsSubject = new BehaviorSubject<EditorTab[]>([]);
  public tabs$ = this.tabsSubject.asObservable();
  
  private activeTabSubject = new BehaviorSubject<string | null>(null);
  public activeTab$ = this.activeTabSubject.asObservable();

  getTabs(): EditorTab[] {
    return this.tabsSubject.value;
  }

  openTab(documentId: string, title: string) {
    const tabs = this.tabsSubject.value;
    
    // Check if tab already exists
    const existingTab = tabs.find(t => t.documentId === documentId);
    
    if (existingTab) {
      // Just activate the existing tab
      this.setActiveTab(existingTab.id);
    } else {
      // Create new tab
      const newTab: EditorTab = {
        id: `tab-${Date.now()}`,
        documentId,
        title,
        isActive: true
      };
      
      // Deactivate all other tabs
      const updatedTabs = tabs.map(t => ({ ...t, isActive: false }));
      updatedTabs.push(newTab);
      
      this.tabsSubject.next(updatedTabs);
      this.activeTabSubject.next(newTab.id);
    }
  }

  closeTab(tabId: string) {
    const tabs = this.tabsSubject.value;
    const index = tabs.findIndex(t => t.id === tabId);
    
    if (index === -1) return;
    
    const updatedTabs = tabs.filter(t => t.id !== tabId);
    
    // If closing active tab, activate another one
    if (tabs[index].isActive && updatedTabs.length > 0) {
      const newActiveIndex = Math.min(index, updatedTabs.length - 1);
      updatedTabs[newActiveIndex].isActive = true;
      this.activeTabSubject.next(updatedTabs[newActiveIndex].id);
    } else if (updatedTabs.length === 0) {
      this.activeTabSubject.next(null);
    }
    
    this.tabsSubject.next(updatedTabs);
  }

  setActiveTab(tabId: string) {
    const tabs = this.tabsSubject.value;
    const updatedTabs = tabs.map(t => ({
      ...t,
      isActive: t.id === tabId
    }));
    
    this.tabsSubject.next(updatedTabs);
    this.activeTabSubject.next(tabId);
  }

  getActiveTab(): EditorTab | null {
    return this.tabsSubject.value.find(t => t.isActive) || null;
  }

  renameTab(documentId: string, newTitle: string) {
    const tabs = this.tabsSubject.value;
    const updatedTabs = tabs.map(t => 
      t.documentId === documentId 
        ? { ...t, title: newTitle }
        : t
    );
    
    this.tabsSubject.next(updatedTabs);
  }
}
