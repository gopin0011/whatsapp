import Dexie, { Table } from 'dexie';

// 1. Interface untuk item riwayat pesan
export interface MessageItem {
  id: string;
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
  jid: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  pushName?: string;
  displayName: string;
  instance?: string;
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
      chats: 'jid, timestamp, displayName',
      messages: 'id, jid, timestamp'
    });
  }
}

// 4. Export instans tunggal untuk dipakai di seluruh komponen
export const db = new WhatsAppOfflineDB();