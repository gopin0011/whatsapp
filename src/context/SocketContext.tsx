import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Centrifuge, Subscription } from 'centrifuge';
import { db } from '../db/chatDb'; 
import axios from 'axios';

interface SocketContextType {
  centrifuge: Centrifuge | null;
  isConnected: boolean;
  isSyncing: boolean;
  activeInstance: string;
}

interface SocketProviderProps {
  children: ReactNode;
  instance?: string;
}

const SocketContext = createContext<SocketContextType>({
  centrifuge: null,
  isConnected: false,
  isSyncing: false,
  activeInstance: 'wa-ninih',
});

export const SocketProvider: React.FC<SocketProviderProps> = ({ 
  children, 
  instance = 'wa-ninih' 
}) => {
  const [centrifuge, setCentrifuge] = useState<Centrifuge | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const socketBufferRef = useRef<any[]>([]);
  const isConnectedRef = useRef<boolean>(false);
  
  // 🟢 1. TAMBAHKAN REF UNTUK MENANDAI STATUS SYNC
  const isSyncingRef = useRef<boolean>(false);
  
  const subRef = useRef<Subscription | null>(null);

  const formatMediaUrl = (
    urlPath: string | null | undefined, 
    isThumb: boolean = false, 
    msgType: string = 'text'
  ): string => {
    if (!urlPath) return "";
    if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) return urlPath;
    
    const mediaBaseUrl = import.meta.env.VITE_API_CLIENT_URL || "http://192.168.100.245:8082";
    const fileName = urlPath.split("/").pop() || "";
    const isAudio = ['audio', 'voice', 'ptt'].includes(msgType);

    if (isThumb && !isAudio) {
      return `${mediaBaseUrl.replace(/\/$/, "")}/media/thumb/${fileName}`;
    }
    return `${mediaBaseUrl.replace(/\/$/, "")}/media/${fileName}`;
  };

  const formatPreviewText = (text: string, mediaType: string) => {
    if (text && text.trim() !== '') return text;

    switch (mediaType) {
      case 'image': return '📷 Foto';
      case 'video': return '🎥 Video';
      case 'audio':
      case 'voice':
      case 'ptt': return '🎙️ Pesan Suara';
      case 'document': return '📄 Dokumen';
      case 'sticker': return '🎨 Stiker';
      case 'location': return '📍 Lokasi';
      case 'contact': return '👤 Kontak';
      default: return text || '';
    }
  };

  const saveToDexie = async (msg: any) => {
    try {
      const payload = msg?.data || msg;

      const msgInstance = payload.instance || instance || 'wa-ninih';
      const msgId = payload.id || payload.key?.id || `${Date.now()}_${Math.random()}`;
      const jid = payload.jid || payload.key?.remoteJid;
      
      if (!jid) return;

      const fromMe = payload.fromMe ?? payload.key?.fromMe ?? payload.isMyMsg ?? false;
      const rawText = payload.text || payload.message || payload.rawText || '';
      const timestamp = payload.timestamp || payload.date || new Date().toISOString();
      const pushName = payload.pushName || payload.contactName || payload.displayName;
      
      const rawMediaUrl = payload.mediaUrl || payload.file;
      const rawThumbUrl = payload.thumbUrl || rawMediaUrl;
      const msgType = payload.mediaType || payload.msgType || 'text';
      const displayText = payload.displayText || formatPreviewText(rawText, msgType);

      await db.transaction('rw', db.messages, db.chats, async () => {
        await db.messages.put({
          id: String(msgId),
          instance: msgInstance,
          jid: jid,
          message: rawText || displayText,
          timestamp: timestamp,
          isMyMsg: Boolean(fromMe),
          msgType: msgType,
          file: formatMediaUrl(rawMediaUrl, false, msgType),
          thumbUrl: formatMediaUrl(rawThumbUrl, true, msgType),
          sender: { name: pushName || jid.split('@')[0] || 'Unknown' }
        });

        const existingChat = await db.chats.get([msgInstance, jid]);

        if (!existingChat || new Date(timestamp).getTime() >= new Date(existingChat.timestamp).getTime()) {
          await db.chats.put({
            instance: msgInstance,
            jid: jid,
            text: displayText,
            timestamp: timestamp,
            fromMe: Boolean(fromMe),
            pushName: pushName || existingChat?.pushName,
            displayName: payload.displayName || pushName || existingChat?.displayName || jid.split('@')[0],
            avatarUrl: payload.avatarUrl || existingChat?.avatarUrl || null
          });
        }
      });
    } catch (error) {
      console.error('❌ Gagal menyimpan ke Dexie:', error);
    }
  };

  // Kuras antrian buffer WebSocket
  const processBuffer = async () => {
    if (socketBufferRef.current.length > 0) {
      console.log(`🚀 Menguras ${socketBufferRef.current.length} pesan tertunda dari antrian...`);
      const queue = [...socketBufferRef.current];
      socketBufferRef.current = [];

      for (const msg of queue) {
        await saveToDexie(msg);
      }
    }
  };

  // 🟢 2. SINKRONISASI DIPERBAIKI (Tandai Ref & Kuras Buffer di Akhir)
  const syncMissingMessagesFromBackend = async () => {
    try {
      setIsSyncing(true);
      isSyncingRef.current = true;

      const apiBaseUrl = import.meta.env.VITE_API_CLIENT_URL || 'http://192.168.100.245:8082';
      const totalMessages = await db.messages.where('instance').equals(instance).count();

      let queryParams: any = { instance };

      if (totalMessages > 0) {
        const lastMessages = await db.messages
          .where('instance')
          .equals(instance)
          .reverse()
          .sortBy('timestamp');

        if (lastMessages.length > 0) {
          queryParams.since = lastMessages[0].timestamp;
        }
      }

      const res = await axios.get(`${apiBaseUrl.replace(/\/$/, '')}/chats/sync`, {
        params: queryParams
      });

      const missingMessages = res.data?.data || [];

      if (Array.isArray(missingMessages) && missingMessages.length > 0) {
        console.log(`✨ Memproses ${missingMessages.length} pesan dari backend (Bulk Insert)...`);

        // 🟢 FORMAT DATA SECARA BATCH
        const formattedMessages: any[] = [];
        const chatMap = new Map<string, any>();

        for (const msg of missingMessages) {
          const payload = msg?.data || msg;
          const msgInstance = payload.instance || instance || 'wa-ninih';
          const msgId = payload.id || payload.key?.id || `${Date.now()}_${Math.random()}`;
          const jid = payload.jid || payload.key?.remoteJid;

          if (!jid) continue;

          const fromMe = payload.fromMe ?? payload.key?.fromMe ?? payload.isMyMsg ?? false;
          const rawText = payload.text || payload.message || payload.rawText || '';
          const timestamp = payload.timestamp || payload.date || new Date().toISOString();
          const pushName = payload.pushName || payload.contactName || payload.displayName;
          const rawMediaUrl = payload.mediaUrl || payload.file;
          const rawThumbUrl = payload.thumbUrl || rawMediaUrl;
          const msgType = payload.mediaType || payload.msgType || 'text';
          const displayText = payload.displayText || formatPreviewText(rawText, msgType);

          // Susun array pesan
          formattedMessages.push({
            id: String(msgId),
            instance: msgInstance,
            jid: jid,
            message: rawText || displayText,
            timestamp: timestamp,
            isMyMsg: Boolean(fromMe),
            msgType: msgType,
            file: formatMediaUrl(rawMediaUrl, false, msgType),
            thumbUrl: formatMediaUrl(rawThumbUrl, true, msgType),
            sender: { name: pushName || jid.split('@')[0] || 'Unknown' }
          });

          // Ambil pesan terbaru per-chat untuk update header daftar chat
          const chatKey = `${msgInstance}_${jid}`;
          const existingChat = chatMap.get(chatKey);
          if (!existingChat || new Date(timestamp).getTime() >= new Date(existingChat.timestamp).getTime()) {
            chatMap.set(chatKey, {
              instance: msgInstance,
              jid: jid,
              text: displayText,
              timestamp: timestamp,
              fromMe: Boolean(fromMe),
              pushName: pushName,
              displayName: payload.displayName || pushName || jid.split('@')[0],
              avatarUrl: payload.avatarUrl || null
            });
          }
        }

        // 🟢 SIMPAN SEKALIGUS (BULK) KE DEXIE
        await db.transaction('rw', db.messages, db.chats, async () => {
          await db.messages.bulkPut(formattedMessages);
          await db.chats.bulkPut(Array.from(chatMap.values()));
        });

        console.log('✅ Sukses menyimpan puluhan ribu data ke Dexie!');
      }
    } catch (error) {
      console.error('❌ Gagal sync pesan dari backend:', error);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
      await processBuffer();
    }
  };

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_API_SOCKET_URL || 'ws://192.168.100.245:8000/connection/websocket';
    const client = new Centrifuge(wsUrl);

    client.on('connected', async (ctx) => {
      console.log('✅ CENTRIFUGO CONNECTED:', ctx);
      setIsConnected(true);
      isConnectedRef.current = true;

      // 🟢 Langsung jalankan sync backend (Buffer otomatis dikuras di dalam fungsi ini)
      await syncMissingMessagesFromBackend();
    });

    client.on('disconnected', () => {
      setIsConnected(false);
      isConnectedRef.current = false;
    });

    client.connect();
    setCentrifuge(client);

    return () => {
      client.disconnect();
    };
  }, [instance]);

  useEffect(() => {
    if (!centrifuge) return;

    const channelName = `whatsapp:messages:${instance}`;

    if (subRef.current) {
      subRef.current.unsubscribe();
      subRef.current = null;
    }

    const sub = centrifuge.newSubscription(channelName, {
      positioned: true,
      recoverable: true
    });

    // 🟢 3. LOGIKA PENANGANAN PUBLICATION
    sub.on('publication', async (ctx) => {
      console.log("📩 PESAN BARU DITERIMA DARI WEBSOCKET:", ctx.data);

      // Cek apakah WebSocket terhubung DAN TIDAK SEDANG SINKRONISASI HTTP
      if (isConnectedRef.current && !isSyncingRef.current) {
        await saveToDexie(ctx.data);
      } else {
        console.warn('⚠️ Socket offline atau sedang proses Sync HTTP, menyimpan pesan ke antrian buffer...');
        socketBufferRef.current.push(ctx.data);
      }
    });

    subRef.current = sub;
    sub.subscribe();

    return () => {
      sub.unsubscribe();
      if (subRef.current === sub) {
        subRef.current = null;
      }
    };
  }, [centrifuge, instance]);

  return (
    <SocketContext.Provider value={{ centrifuge, isConnected, isSyncing, activeInstance: instance }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);