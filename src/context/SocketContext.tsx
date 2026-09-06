import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Centrifuge } from 'centrifuge';

// Type definition
interface SocketContextType {
  centrifuge: Centrifuge | null;
  isConnected: boolean;
}

// 1. Inisialisasi Context
const SocketContext = createContext<SocketContextType>({
  centrifuge: null,
  isConnected: false,
});

// 2. Component Provider
export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [centrifuge, setCentrifuge] = useState<Centrifuge | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

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

    return () => {
      client.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ centrifuge, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

// 3. Custom Hook untuk memanggil Socket di file mana pun
export const useSocket = () => {
  return useContext(SocketContext);
};