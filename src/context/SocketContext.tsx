import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Centrifuge, Subscription } from 'centrifuge';
import { db } from '../db/chatDb'; 
import axios from 'axios';

interface SocketContextType {
  centrifuge: Centrifuge | null;
  isConnected: boolean;
  activeInstance: string;
}

interface SocketProviderProps {
  children: ReactNode;
  instance?: string;
}

const SocketContext = createContext<SocketContextType>({
  centrifuge: null,
  isConnected: false,
  activeInstance: 'wa-ninih',
});

export const SocketProvider: React.FC<SocketProviderProps> = ({ 
  children, 
  instance = 'wa-ninih' 
}) => {
  const [centrifuge, setCentrifuge] = useState<Centrifuge | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const socketBufferRef = useRef<any[]>([]);
  const isConnectedRef = useRef<boolean>(false);
  const subRef = useRef<Subscription | null>(null);

  // Helper format media URL
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

  // Helper formatting preview text untuk UI Home jika pesan berupa media
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

  // Simpan ke Dexie
  const saveToDexie = async (msg: any) => {
    try {
      const payload = msg?.data || msg;

      const msgInstance = payload.instance || instance || 'wa-ninih';
      const msgId = payload.id || payload.key?.id || `${Date.now()}_${Math.random()}`;
      const jid = payload.jid || payload.key?.remoteJid;
      
      if (!jid) {
        console.warn('⚠️ Pesan WebSocket diabaikan karena JID kosong:', payload);
        return;
      }

      // Deteksi fromMe secara akurat
      const fromMe = payload.fromMe ?? payload.key?.fromMe ?? payload.isMyMsg ?? false;
      const rawText = payload.text || payload.message || payload.rawText || '';
      const timestamp = payload.timestamp || payload.date || new Date().toISOString();
      const pushName = payload.pushName || payload.contactName || payload.displayName;
      
      const rawMediaUrl = payload.mediaUrl || payload.file;
      const rawThumbUrl = payload.thumbUrl || rawMediaUrl;
      const msgType = payload.mediaType || payload.msgType || 'text';

      // Format teks khusus agar di Home tidak kosong kalau kirim foto/suara
      const displayText = payload.displayText || formatPreviewText(rawText, msgType);

      await db.transaction('rw', db.messages, db.chats, async () => {
        // 1. Simpan ke daftar riwayat pesan
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

        // 2. Cek pesan terakhir di Chat Home agar tidak tertimpa pesan lama jika WebSocket urutannya tertukar
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

      console.log(`✅ [${msgInstance}] Pesan dari ${jid} berhasil disimpan ke IndexedDB!`);
    } catch (error) {
      console.error('❌ Gagal menyimpan ke Dexie:', error);
    }
  };

  // FUNGSI MENGURAS ANTRIAN (Flush Queue)
  const processBuffer = async () => {
    if (socketBufferRef.current.length > 0) {
      console.log(`🚀 Menguras ${socketBufferRef.current.length} pesan tertunda dari antrian...`);
      const queue = [...socketBufferRef.current];
      socketBufferRef.current = []; // KOSONGKAN ANTRIAN

      for (const msg of queue) {
        await saveToDexie(msg);
      }
      console.log('✨ Semua antrian berhasil dikuras!');
    }
  };

  // Kuras antrian dari backend server
  const syncMissingMessagesFromBackend = async () => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_CLIENT_URL || 'http://192.168.100.245:8082';

      // 1. Ambil pesan paling terakhir yang tersimpan di IndexedDB milik instance ini
      const lastMessages = await db.messages
        .where('instance')
        .equals(instance)
        .reverse()
        .sortBy('timestamp');

      const lastTimestamp = lastMessages.length > 0 
        ? lastMessages[0].timestamp 
        : new Date(0).toISOString();

      console.log(`🔄 Sync missing messages sejak: ${lastTimestamp}`);

      // 2. Minta ke backend
      const res = await axios.get(`${apiBaseUrl.replace(/\/$/, '')}/chats/sync`, {
        params: { 
          instance: instance, 
          since: lastTimestamp 
        }
      });

      const missingMessages = res.data?.data || [];

      // 3. Simpan pesan yang ketinggalan ke Dexie
      if (missingMessages.length > 0) {
        console.log(`📦 Menarik ${missingMessages.length} pesan tertunda dari backend...`);
        for (const msg of missingMessages) {
          await saveToDexie(msg);
        }
      }
    } catch (error) {
      console.error('❌ Gagal sync pesan dari backend:', error);
    }
  };

  // Effect 1: Inisialisasi Koneksi Websocket Utama
  useEffect(() => {
    const wsUrl =
      import.meta.env.VITE_API_SOCKET_URL ||
      'ws://192.168.100.245:8000/connection/websocket';

    const client = new Centrifuge(wsUrl);

    client.on('connected', (ctx) => {
      console.log('✅✅✅ CENTRIFUGO CONNECTED:', ctx);

      setIsConnected(true);
      isConnectedRef.current = true;

      processBuffer();
      syncMissingMessagesFromBackend();
    });

    client.on('disconnected', (ctx) => {
      console.warn('⚠️ Centrifugo disconnected:', ctx);

      setIsConnected(false);
      isConnectedRef.current = false;
    });

    client.on('error', (err) => {
      console.error('❌ Centrifugo connection error:', err);
    });

    client.connect();
    setCentrifuge(client);

    return () => {
      client.disconnect();
    };
  }, []);

  // Effect 2: Dynamic Subscription berdasarkan instance
  useEffect(() => {
    if (!centrifuge) return;

    const channelName = `whatsapp:messages:${instance}`;

    if (subRef.current) {
      subRef.current.unsubscribe();
      subRef.current = null;
    }

    let sub: Subscription;

    try {
      sub = centrifuge.newSubscription(channelName, {
        positioned: true,
        recoverable: true
      });
    } catch (error) {
      console.error('❌ Gagal membuat subscription:', error);
      return;
    }

    sub.on('publication', async (ctx) => {
      console.log("📩 PESAN BARU DITERIMA DARI WEBSOCKET:", ctx.data);

      if (isConnectedRef.current) {
        await saveToDexie(ctx.data);
      } else {
        console.warn('⚠️ Socket offline, menyimpan pesan ke antrian buffer...');
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
    <SocketContext.Provider value={{ centrifuge, isConnected, activeInstance: instance }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);