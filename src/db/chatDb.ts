import Dexie, { Table } from 'dexie';

// 1. Interface untuk item riwayat pesan
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

// 2. Interface untuk item daftar chat room
export interface ChatItem {
  instance?: string;
  jid: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  pushName?: string;
  displayName: string;
  avatarUrl?: string;
}

// 3. Subkelas Dexie bertipe lengkap
export class WhatsAppOfflineDB extends Dexie {
  chats!: Table<ChatItem, string>;
  messages!: Table<MessageItem, string>;

  constructor() {
    super('WhatsAppOfflineDB');
    
    // Indeks pencarian disesuaikan dengan milikmu
    this.version(1).stores({
      chats: '[instance+jid], instance, timestamp, [instance+timestamp], displayName',
      messages: 'id, [instance+jid], instance, timestamp'
    });
  }
}

// 4. Export instans tunggal untuk dipakai di seluruh komponen
export const db = new WhatsAppOfflineDB();