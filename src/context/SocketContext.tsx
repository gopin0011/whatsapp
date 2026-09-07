import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Centrifuge } from 'centrifuge';
import { useDispatch } from 'react-redux';
import { db } from '../db/chatDb'; 
import { appendMessage } from '../Redux/reducers/chat/chatSlice'; 

interface SocketContextType {
  centrifuge: Centrifuge | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  centrifuge: null,
  isConnected: false,
});

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [centrifuge, setCentrifuge] = useState<Centrifuge | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const dispatch = useDispatch();

  // Reference untuk penanganan buffer pesan saat offline
  const socketBufferRef = useRef<any[]>([]);
  const isConnectedRef = useRef<boolean>(false);

  // Helper untuk menyimpan pesan & memperbarui room terakhir di Dexie
  const saveToDexie = async (msg: any) => {
    try {
      const msgId = msg.id || msg.key?.id || new Date().getTime().toString();
      const jid = msg.jid || msg.data?.jid;
      const text = msg.text || msg.data?.text || '';
      const timestamp = msg.timestamp || msg.data?.timestamp || new Date().toISOString();
      const fromMe = msg.fromMe ?? msg.data?.fromMe ?? false;
      const pushName = msg.pushName || msg.data?.pushName;

      if (!jid) return;

      await db.transaction('rw', db.messages, db.chats, async () => {
        // 1. Simpan/Update Pesan di Dexie
        await db.messages.put({
          id: msgId,
          jid: jid,
          message: text,
          timestamp: timestamp,
          isMyMsg: fromMe,
          msgType: msg.mediaType || 'text',
          file: msg.mediaUrl,
          sender: { name: pushName || jid.split('@')[0] || 'Unknown' }
        });

        // 2. Update status Room Chat di Home Page pada Dexie
        await db.chats.put({
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

  // Proses dan flush buffer saat socket reconnect
  const processBuffer = async () => {
    if (socketBufferRef.current.length > 0) {
      const queue = [...socketBufferRef.current];
      socketBufferRef.current = [];
      for (const msg of queue) {
        await saveToDexie(msg);
      }
    }
  };

  // Dispatch ke Redux sekaligus Simpan/Buffer ke Dexie
  const handleIncomingMessage = (newMessage: any) => {
    const incomingJid = newMessage.jid || newMessage.data?.jid;
    if (!incomingJid) return;

    // Formatter data untuk Redux State
    const formattedMsg = {
      _id: newMessage.id || newMessage.key?.id || new Date().getTime().toString(),
      message: newMessage.text || newMessage.data?.text || '',
      date: newMessage.timestamp || newMessage.data?.timestamp || new Date().toISOString(),
      isMyMsg: newMessage.fromMe ?? newMessage.data?.fromMe ?? false,
      msgType: newMessage.mediaType || 'text',
      file: newMessage.mediaUrl,
      sender: {
        name:
          newMessage.pushName ||
          newMessage.data?.pushName ||
          incomingJid.split('@')[0] ||
          'Unknown',
      },
      raw: newMessage
    };

    // 1. Update UI secara real-time via Redux
    dispatch(appendMessage({ jid: incomingJid, message: formattedMsg }));

    // 2. Tahan di Buffer atau langsung simpan ke Dexie
    if (!isConnectedRef.current) {
      socketBufferRef.current.push(newMessage);
    } else {
      saveToDexie(newMessage);
    }
  };

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_API_SOCKET_URL || 'ws://192.168.100.245:8000/connection/websocket';
    const client = new Centrifuge(wsUrl);

    client.on('connected', (ctx) => {
      console.log('Centrifugo Connected:', ctx);
      setIsConnected(true);
      isConnectedRef.current = true;
      processBuffer(); // Flush pesan terpending
    });

    client.on('disconnected', (ctx) => {
      console.log('Centrifugo Disconnected:', ctx);
      setIsConnected(false);
      isConnectedRef.current = false;
    });

    client.connect();
    setCentrifuge(client);

    // Subskripsi Channel Centrifugo
    const channelName = 'whatsapp:messages';
    const sub = client.newSubscription(channelName);

    sub.on('publication', (ctx: any) => {
      handleIncomingMessage(ctx.data);
    });

    sub.subscribe();

    return () => {
      sub.unsubscribe();
      client.disconnect();
    };
  }, [dispatch]);

  return (
    <SocketContext.Provider value={{ centrifuge, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};