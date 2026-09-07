import Dexie, { Table } from 'dexie';

export interface MessageItem {
  id: string;
  instance: string;
  jid: string;
  message: string;
  timestamp: string;
  isMyMsg: boolean;
  msgType: string;
  file?: string;
  thumbUrl?: string;
  sender: { name: string };
}

export interface ChatItem {
  instance: string;
  jid: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  pushName?: string;
  displayName: string;
  avatarUrl?: string;
}

export class WhatsAppOfflineDB extends Dexie {
  chats!: Table<ChatItem, [string, string]>; // Primary key berupa tuple [instance, jid]
  messages!: Table<MessageItem, string>;

  constructor() {
    super('WhatsAppOfflineDB');
    
    // Naikkan versi ke 2 untuk memperbarui skema primary key
    this.version(2).stores({
      chats: '[instance+jid], instance, jid, timestamp',
      messages: 'id, instance, jid, timestamp'
    });
  }
}

export const db = new WhatsAppOfflineDB();