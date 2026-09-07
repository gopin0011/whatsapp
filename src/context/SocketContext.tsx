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
  instance?: string; // Menerima prop instance dinamis
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

  // Simpan ke Dexie (otomatis menyertakan field instance)
  const saveToDexie = async (msg: any) => {
    try {
      const msgInstance = msg.instance || msg.data?.instance || instance;
      const msgId = msg.id || msg.key?.id || msg.data?.id || new Date().getTime().toString();
      const jid = msg.jid || msg.data?.jid;
      const text = msg.text || msg.data?.text || '';
      const timestamp = msg.timestamp || msg.data?.timestamp || new Date().toISOString();
      const fromMe = msg.fromMe ?? msg.data?.fromMe ?? false;
      const pushName = msg.pushName || msg.data?.pushName;
      
      const rawMediaUrl = msg.mediaUrl || msg.file || msg.data?.mediaUrl || msg.data?.file;
      const rawThumbUrl = msg.thumbUrl || msg.data?.thumbUrl || rawMediaUrl;
      const msgType = msg.mediaType || msg.msgType || msg.data?.mediaType || msg.data?.msgType || 'text';
      
      if (!jid) return;

      await db.transaction('rw', db.messages, db.chats, async () => {
        // 1. Simpan pesan
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

        // 2. Update status Room Chat
        await db.chats.put({
          instance: msgInstance,
          jid: jid,
          text: text,
          timestamp: timestamp,
          fromMe: fromMe,
          pushName: pushName,
          displayName: msg.displayName || pushName || jid.split('@')[0] || 'Unknown'
        });
      });
    } catch (error) {
      console.error('Gagal menyimpan ke Dexie:', error);
    }
  };

  const handleIncomingMessage = (newMessage: any) => {
    const incomingJid = newMessage.jid || newMessage.data?.jid;
    if (!incomingJid) return;

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
    const client = new Centrifuge(wsUrl);

    client.on('connected', () => {
      setIsConnected(true);
      isConnectedRef.current = true;
      processBuffer();
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
  }, []);

  // Effect 2: Dynamic Subscription berdasarkan instance
  useEffect(() => {
    if (!centrifuge) return;

    // 1. Unsubscribe channel lama jika ada
    if (subRef.current) {
      subRef.current.unsubscribe();
    }

    // 2. Subscribe ke channel instance baru
    const channelName = `whatsapp:messages:${instance}`;
    const sub = centrifuge.newSubscription(channelName);

    sub.on('publication', (ctx: any) => {
      handleIncomingMessage(ctx.data);
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