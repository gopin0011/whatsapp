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

  // Helper untuk formatting URL media & thumbnail
  const formatMediaUrl = (
    urlPath: string | null | undefined, 
    isThumb: boolean = false, 
    msgType: string = 'text'
  ): string => {
    if (!urlPath) return "";
    if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
      return urlPath;
    }
    
    const mediaBaseUrl = import.meta.env.VITE_API_CLIENT_URL || "http://192.168.100.245:8082";
    const fileName = urlPath.split("/").pop() || "";
    
    // Jika tipe pesan adalah audio/voice/ptt, JANGAN PERNAH gunakan folder /thumb/
    const isAudio = ['audio', 'voice', 'ptt'].includes(msgType);

    if (isThumb && !isAudio) {
      return `${mediaBaseUrl.replace(/\/$/, "")}/media/thumb/${fileName}`;
    }
    
    return `${mediaBaseUrl.replace(/\/$/, "")}/media/${fileName}`;
  };

  // Helper untuk menyimpan pesan & memperbarui room terakhir di Dexie
  const saveToDexie = async (msg: any) => {
    try {
      const msgId = msg.id || msg.key?.id || msg.data?.id || new Date().getTime().toString();
      const jid = msg.jid || msg.data?.jid;
      const text = msg.text || msg.data?.text || '';
      const timestamp = msg.timestamp || msg.data?.timestamp || new Date().toISOString();
      const fromMe = msg.fromMe ?? msg.data?.fromMe ?? false;
      const pushName = msg.pushName || msg.data?.pushName;
      
      // Ambil path media & thumb dari root atau dari objek inner msg.data
      const rawMediaUrl = msg.mediaUrl || msg.file || msg.data?.mediaUrl || msg.data?.file;
      const rawThumbUrl = msg.thumbUrl || msg.data?.thumbUrl || rawMediaUrl;
      const msgType = msg.mediaType || msg.msgType || msg.data?.mediaType || msg.data?.msgType || 'text';
      
      if (!jid) return;

      await db.transaction('rw', db.messages, db.chats, async () => {
        // 1. Simpan/Update Pesan di Dexie
        await db.messages.put({
          id: msgId,
          jid: jid,
          message: text,
          timestamp: timestamp,
          isMyMsg: fromMe,
          msgType: msgType,
          file: formatMediaUrl(rawMediaUrl, false, msgType),
          thumbUrl: formatMediaUrl(rawThumbUrl, true, msgType),
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

  // Dispatch ke Redux sekaligus Simpan/Buffer ke Dexie
  const handleIncomingMessage = (newMessage: any) => {
    const incomingJid = newMessage.jid || newMessage.data?.jid;
    if (!incomingJid) return;

    const rawMediaUrl = newMessage.mediaUrl || newMessage.file || newMessage.data?.mediaUrl || newMessage.data?.file;
    const rawThumbUrl = newMessage.thumbUrl || newMessage.data?.thumbUrl || rawMediaUrl;
    const msgType = newMessage.mediaType || newMessage.msgType || newMessage.data?.mediaType || newMessage.data?.msgType || 'text';

    // Formatter data untuk Redux State
    const formattedMsg = {
      _id: newMessage.id || newMessage.key?.id || newMessage.data?.id || new Date().getTime().toString(),
      message: newMessage.text || newMessage.data?.text || '',
      date: newMessage.timestamp || newMessage.data?.timestamp || new Date().toISOString(),
      isMyMsg: newMessage.fromMe ?? newMessage.data?.fromMe ?? false,
      msgType: msgType,
      file: formatMediaUrl(rawMediaUrl, false, msgType),
      thumbUrl: formatMediaUrl(rawThumbUrl, true, msgType),
      sender: {
        name: newMessage.pushName || newMessage.data?.pushName || incomingJid.split('@')[0] || 'Unknown',
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