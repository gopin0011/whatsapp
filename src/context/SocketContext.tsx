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

  // Simpan ke Dexie
  const saveToDexie = async (msg: any) => {
    try {
      const payload = msg?.data || msg;

      const msgInstance = payload.instance || instance || 'wa-ninih';
      const msgId = payload.id || payload.key?.id || new Date().getTime().toString();
      const jid = payload.jid || payload.key?.remoteJid;
      const text = payload.text || payload.message || '';
      const timestamp = payload.timestamp || new Date().toISOString();
      const fromMe = payload.fromMe ?? payload.isMyMsg ?? false;
      const pushName = payload.pushName || payload.contactName || payload.displayName;
      
      const rawMediaUrl = payload.mediaUrl || payload.file;
      const rawThumbUrl = payload.thumbUrl || rawMediaUrl;
      const msgType = payload.mediaType || payload.msgType || 'text';
      
      if (!jid) {
        console.warn('⚠️ Pesan WebSocket diabaikan karena JID kosong:', payload);
        return;
      }

      await db.transaction('rw', db.messages, db.chats, async () => {
        // 1. Simpan ke daftar riwayat pesan
        await db.messages.put({
          id: msgId,
          instance: msgInstance,
          jid: jid,
          message: text,
          timestamp: timestamp,
          isMyMsg: fromMe,
          msgType: msgType,
          file: formatMediaUrl(rawMediaUrl, false, msgType),
          thumbUrl: formatMediaUrl(rawThumbUrl, true, msgType),
          sender: { name: pushName || jid.split('@')[0] || 'Unknown' }
        });

        // 2. Update daftar chat room utama
        await db.chats.put({
          instance: msgInstance,
          jid: jid,
          text: text,
          timestamp: timestamp,
          fromMe: fromMe,
          pushName: pushName,
          displayName: payload.displayName || pushName || jid.split('@')[0] || 'Unknown',
          avatarUrl: payload.avatarUrl || null
        });
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
      console.log(`🔄 Mengontak backend untuk flush queue instance [${instance}]...`);

      const res = await axios.post(`${apiBaseUrl.replace(/\/$/, '')}/chats/flush-queue/${instance}`);
      
      const pendingData = res.data?.data;

      if (Array.isArray(pendingData) && pendingData.length > 0) {
        console.log(`📦 Diterima ${pendingData.length} pesan tertunda dari backend, menyimpan ke Dexie...`);
        for (const msg of pendingData) {
          await saveToDexie(msg);
        }
        console.log('✨ Berhasil menyimpan seluruh antrian backend ke Dexie!');
      } else {
        console.log('👍 Tidak ada pesan tertunda di backend.');
      }
    } catch (error) {
      console.error('❌ Gagal sync missing messages dari backend:', error);
    }
  };

  // Effect 1: Inisialisasi Koneksi Websocket Utama
  useEffect(() => {
    const wsUrl =
      import.meta.env.VITE_API_SOCKET_URL ||
      'ws://192.168.100.245:8000/connection/websocket';

    console.log('======================================');
    console.log('🔌 CENTRIFUGO CONNECT:', wsUrl);
    console.log('======================================');

    const client = new Centrifuge(wsUrl);

    client.on('connecting', (ctx) => {
      console.log('🔄 Centrifugo connecting:', ctx);
    });

    client.on('connected', (ctx) => {
      console.log('✅✅✅ CENTRIFUGO CONNECTED:', ctx);

      setIsConnected(true);
      isConnectedRef.current = true;

      // 1. Kuras buffer lokal frontend
      processBuffer();

      // 2. Kuras antrian pesan dari backend server
      syncMissingMessagesFromBackend();
    });

    client.on('disconnected', (ctx) => {
      console.warn('⚠️ Centrifugo disconnected:', ctx);

      setIsConnected(false);
      isConnectedRef.current = false;
    });

    client.on('error', (err) => {
      console.error('❌❌❌ Centrifugo connection error:', err);
    });

    client.connect();
    setCentrifuge(client);

    return () => {
      console.log('🧹 Disconnect Centrifugo');
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

      // Jika socket dalam kondisi terhubung, langsung simpan
      if (isConnectedRef.current) {
        await saveToDexie(ctx.data);
      } else {
        // Jika sedang disconnect/reconnecting, MASUKKAN KE ANTRIAN (BUFFER)
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