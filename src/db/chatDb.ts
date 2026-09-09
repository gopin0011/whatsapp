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
  isGroup?: boolean;

}

// 🟢 TAMBAHKAN INTERFACE CONTACT
export interface ContactItem {
  jid: string;
  instance: string;
  name?: string;
  avatarUrl?: string;
  isGroup?: boolean;
  updatedAt?: string;
}

export class WhatsAppOfflineDB extends Dexie {
  chats!: Table<ChatItem, [string, string]>;
  messages!: Table<MessageItem, string>;
  contacts!: Table<ContactItem, [string, string]>;

  constructor() {
    super('WhatsAppOfflineDB');

    // 1. Definisikan skema lama di versi 1 (Skema sebelum diubah)
    this.version(1).stores({
      chats: 'jid, instance, timestamp',
      messages: 'id, instance, jid, timestamp'
    });

    // 2. Naikkan ke versi 2 dengan Primary Key Baru + Pembersihan/Upgrade Data
    this.version(2)
      .stores({
        chats: '[instance+jid], instance, jid, timestamp', // Compound Key Baru
        messages: 'id, instance, jid, timestamp'
      })
      .upgrade(async (trans) => {
        // Hapus isi tabel chats lama agar tidak konflik saat struktur primary key berubah
        await trans.table('chats').clear();
      });

    // 🟢 Naikkan ke Versi 3 untuk mendaftarkan tabel contacts
    this.version(3).stores({
      chats: '[instance+jid], instance, jid, timestamp',
      messages: 'id, instance, jid, timestamp',
      contacts: '[instance+jid], instance, jid' // Compound key instance + jid
    });
  }
}

export const db = new WhatsAppOfflineDB();