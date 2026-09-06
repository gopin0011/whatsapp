import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Centrifuge } from 'centrifuge';
import { useDispatch } from 'react-redux';
import { appendMessage } from '../Redux/reducers/chat/chatSlice'; // Sesuaikan path slice kamu

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

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_API_SOCKET_URL || 'ws://192.168.100.245:8000/connection/websocket';
    const client = new Centrifuge(wsUrl);

    client.on('connected', (ctx) => {
      console.log('Centrifugo Connected:', ctx);
      setIsConnected(true);
    });

    client.on('disconnected', (ctx) => {
      console.log('Centrifugo Disconnected:', ctx);
      setIsConnected(false);
    });

    client.connect();
    setCentrifuge(client);

    // =========================================================
    // LISTENER GLOBAL CENTRIFUGO -> KE REDUX
    // =========================================================
    const channelName = 'whatsapp:messages';
    const sub = client.newSubscription(channelName);

    sub.on('publication', (ctx: any) => {
      const newMessage = ctx.data;
      const incomingJid = newMessage.jid || newMessage.data?.jid;

      if (!incomingJid) return;

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
        raw: newMessage // Menyimpan raw data untuk kebutuhan update daftar chat di Home
      };

      // Simpan/append langsung ke Redux Cache
      dispatch(appendMessage({ jid: incomingJid, message: formattedMsg }));
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