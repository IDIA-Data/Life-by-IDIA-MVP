/**
 * Centralized Notification Store
 *
 * - Persists last 50 events to localStorage (idia_notifications_v1)
 * - Subscribed to via React useSyncExternalStore
 * - Single source of truth for the bell dropdown history
 */

import { useSyncExternalStore } from "react";

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface NotificationItem {
  id: string;
  level: NotificationLevel;
  title: string;
  description?: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "idia_notifications_v1";
const MAX_ITEMS = 50;

function load(): NotificationItem[] {
  console.log("💾 [START: notificationStore.load] Initializing storage retrieval");
  if (typeof window === "undefined") {
    console.warn("💾 [END: notificationStore.load] Window undefined, returning empty array");
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      console.log("💾 [END: notificationStore.load] No existing storage found, returning empty array");
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("💾 [END: notificationStore.load] Storage corrupted, returning empty array");
      return [];
    }
    console.log(`💾 [END: notificationStore.load] Successfully hydrated ${parsed.length} items`);
    return parsed.slice(0, MAX_ITEMS);
  } catch (err: any) {
    console.error("🚨 [END: notificationStore.load] FATAL ERROR parsing localStorage:", err.message);
    return [];
  }
}

let items: NotificationItem[] = load();
const listeners = new Set<() => void>();

function persist() {
  console.log("💾 [START: notificationStore.persist] Committing state to localStorage");
  if (typeof window === "undefined") {
    console.warn("💾 [END: notificationStore.persist] Aborted: Window undefined");
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    console.log("💾 [END: notificationStore.persist] Commit successful");
  } catch (err: any) {
    console.error("🚨 [END: notificationStore.persist] FATAL ERROR writing to localStorage (Quota exceeded?):", err.message);
  }
}

function emit() {
  console.log(`🔔 [START: notificationStore.emit] Broadcasting state change to ${listeners.size} active listeners`);
  for (const l of listeners) {
    l();
  }
  console.log("🔔 [END: notificationStore.emit] Broadcast cycle complete");
}

export const notificationStore = {
  add(level: NotificationLevel, title: string, description?: string) {
    console.log(`🔔 [START: notificationStore.add] Ingesting new '${level}' notification`);
    const item: NotificationItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      title,
      description,
      timestamp: Date.now(),
      read: false,
    };
    items = [item, ...items].slice(0, MAX_ITEMS);
    persist();
    emit();
    console.log(`🔔 [END: notificationStore.add] Notification ${item.id} successfully queued`);
    return item;
  },
  
  markAllRead() {
    console.log("🔔 [START: notificationStore.markAllRead] Executing global read-state mutation");
    items = items.map((i) => ({ ...i, read: true }));
    persist();
    emit();
    console.log("🔔 [END: notificationStore.markAllRead] Mutation complete");
  },
  
  clearAll() {
    console.log("🔔 [START: notificationStore.clearAll] Executing global purge");
    items = [];
    persist();
    emit();
    console.log("🔔 [END: notificationStore.clearAll] Purge complete");
  },
  
  remove(id: string) {
    console.log(`🔔 [START: notificationStore.remove] Purging notification ID: ${id}`);
    items = items.filter((i) => i.id !== id);
    persist();
    emit();
    console.log("🔔 [END: notificationStore.remove] Item purged");
  },
  
  getSnapshot(): NotificationItem[] {
    return items;
  },
  
  subscribe(listener: () => void) {
    console.log("🔔 [START: notificationStore.subscribe] Mounting new UI listener");
    listeners.add(listener);
    console.log("🔔 [END: notificationStore.subscribe] Listener mounted successfully");
    
    // Explicit void return to satisfy React 18 useSyncExternalStore strict contracts
    return () => {
      console.log("🔔 [START: notificationStore.unsubscribe] Unmounting UI listener");
      listeners.delete(listener);
      console.log("🔔 [END: notificationStore.unsubscribe] Listener unmounted successfully");
    };
  },
}; // <-- This is the object closure that was missing/corrupted

export function useNotifications() {
  console.log("⚛️ [START: useNotifications] Hook execution initiated");
  const list = useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.getSnapshot,
    notificationStore.getSnapshot
  );
  console.log(`⚛️ [END: useNotifications] Hook execution complete. Yielding ${list.length} items`);
  return list;
}

export function useUnreadCount() {
  console.log("⚛️ [START: useUnreadCount] Calculating aggregate unread delta");
  const list = useNotifications();
  const unread = list.reduce((n, i) => (i.read ? n : n + 1), 0);
  console.log(`⚛️ [END: useUnreadCount] Calculation complete. Delta: ${unread}`);
  return unread;
}