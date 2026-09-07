import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Centrifuge, Subscription } from 'centrifuge';
import { db } from '../db/chatDb'; 

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
      // Unpack payload secara fleksibel
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

        // 2. Update daftar chat room utama (dengan jid sebagai Primary Key)
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

  const handleIncomingMessage = (newMessage: any) => {
    const payload = newMessage?.data || newMessage;
    const incomingJid = payload?.jid || payload?.key?.remoteJid;

    if (!incomingJid) {
      console.warn('⚠️ Incoming message tidak punya JID:', newMessage);
      return;
    }

    if (!isConnectedRef.current) {
      socketBufferRef.current.push(newMessage);
    } else {
      saveToDexie(newMessage);
    }
  };

  const processBuffer = async () => {
    if (socketBufferRef.current.length > 0) {
      const queue = [...socketBufferRef.current];
      socketBufferRef.current = [];
      for (const msg of queue) {
        await saveToDexie(msg);
      }
    }
  };

  // Effect 1: Inisialisasi Koneksi Websocket Utama
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_API_SOCKET_URL || 'ws://192.168.100.245:8000/connection/websocket';
    console.log('🔄 Memulai koneksi ke Centrifugo URL:', wsUrl);

    const client = new Centrifuge(wsUrl);

    client.on('connected', (ctx) => {
      console.log('✅ Connected to Centrifugo WebSocket:', ctx);
      setIsConnected(true);
      isConnectedRef.current = true;
      processBuffer();
    });

    client.on('disconnected', (ctx) => {
      console.warn('⚠️ Disconnected from Centrifugo WebSocket:', ctx);
      setIsConnected(false);
      isConnectedRef.current = false;
    });

    client.on('error', (err) => {
      console.error('❌ Centrifugo WebSocket Error:', err);
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

    if (subRef.current) {
      subRef.current.unsubscribe();
    }

    const channelName = `whatsapp:messages:${instance}`;
    console.log(`📡 Subscribing ke channel: ${channelName}`);

    const sub = centrifuge.newSubscription(channelName);

    sub.on('subscribed', () => {
      console.log(`🎉 Berhasil tersambung ke channel: ${channelName}`);
    });

    sub.on('publication', (ctx: any) => {
      console.log('📩 Pesan WebSocket masuk:', ctx.data);
      handleIncomingMessage(ctx.data);
    });

    sub.on('error', (err) => {
      console.error(`❌ Gagal subscribe channel ${channelName}:`, err);
    });

    sub.subscribe();
    subRef.current = sub;

    return () => {
      if (subRef.current) {
        subRef.current.unsubscribe();
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