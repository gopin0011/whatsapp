import React, { useEffect, useState } from 'react';
import Users from '../components/utilities/Users';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useSocket } from '../context/SocketContext';

const Home = () => {
  const [latestChats, setLatestChats] = useState<any[]>([]);
  const [isFetchingChats, setIsFetchingChats] = useState(false);

  // Panggil socket & status koneksi via Hook
  const { centrifuge, isConnected } = useSocket();

  // 1. Fetch REST API untuk Data Awal
  useEffect(() => {
    const fetchLatestChats = async () => {
      try {
        setIsFetchingChats(true);
        const baseUrl = import.meta.env.VITE_API_CLIENT_URL || 'http://localhost:8081';
        const response = await axios.get(`${baseUrl}/getChat/wa-ninih`);
        if (response.data?.success) {
          setLatestChats(response.data.data);
        }
      } catch (error) {
        console.error('Gagal mengambil data chat:', error);
        toast.error('Gagal memuat pesan');
      } finally {
        setIsFetchingChats(false);
      }
    };

    fetchLatestChats();
  }, []);

  // 2. Real-time Subscription via Centrifugo
  useEffect(() => {
    if (!centrifuge) return;

    const sub = centrifuge.newSubscription('whatsapp:messages');

    sub.on('publication', (ctx) => {
      const newMessage = ctx.data;
      console.log('Pesan baru dari websocket:', newMessage);

      // 1. Ambil jid dan status fromMe
      const incomingJid = newMessage.jid || newMessage.data?.jid;
      const isFromMe = newMessage.fromMe ?? newMessage.data?.fromMe ?? false;

      // 2. Jika pesan berasal dari diri sendiri (fromMe = true), abaikan / jangan replace
      if (isFromMe || !incomingJid) {
        return;
      }

      // 3. Jika pesan dari orang lain (fromMe = false), lakukan replace/update posisi teratas
      setLatestChats((prevChats) => {
        const filteredChats = prevChats.filter(
          (chat) => chat.jid.toLowerCase() !== incomingJid.toLowerCase()
        );

        // Pastikan struktur data konsisten
        const formattedMessage = {
          ...newMessage,
          jid: incomingJid,
          text: newMessage.text || newMessage.data?.text || '',
          pushName: newMessage.pushName || newMessage.data?.pushName || '',
          timestamp: newMessage.timestamp || new Date().toISOString(),
          fromMe: false,
        };

        return [formattedMessage, ...filteredChats];
      });
    });

    sub.subscribe();

    return () => {
      sub.unsubscribe();
      sub.removeAllListeners();
    };
  }, [centrifuge]);

  return (
    <main className="overflow-hidden relative h-screen">
      <Users latestChats={latestChats} isFetching={isFetchingChats} />
    </main>
  );
};

export default React.memo(Home);