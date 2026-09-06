import React, { useEffect, useState } from 'react';
import Users from '../components/utilities/Users';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useSocket } from '../context/SocketContext';

const Home = () => {
  const [latestChats, setLatestChats] = useState<any[]>([]);
  const [isFetchingChats, setIsFetchingChats] = useState(false);

  const { centrifuge } = useSocket();

  // =========================================================
  // FETCH CHAT AWAL
  // =========================================================
  useEffect(() => {
    const fetchLatestChats = async () => {
      try {
        setIsFetchingChats(true);

        const baseUrl =
          import.meta.env.VITE_API_CLIENT_URL ||
          'http://localhost:8081';

        const response = await axios.get(
          `${baseUrl}/getChat/wa-ninih`
        );

        if (response.data?.success) {
          setLatestChats(response.data.data || []);
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

  // =========================================================
  // REALTIME CENTRIFUGO
  // =========================================================
  useEffect(() => {
    if (!centrifuge) return;

    const sub = centrifuge.newSubscription(
      'whatsapp:messages'
    );

    sub.on('publication', (ctx) => {
      const newMessage = ctx.data;

      console.log(
        'Pesan baru dari websocket:',
        newMessage
      );

      const incomingJid =
        newMessage.jid ||
        newMessage.data?.jid;

      const isFromMe =
        newMessage.fromMe ??
        newMessage.data?.fromMe ??
        false;

      if (!incomingJid) {
        return;
      }

      setLatestChats((prevChats) => {
        const existingChat = prevChats.find(
          (chat) =>
            chat.jid?.toLowerCase() ===
            incomingJid.toLowerCase()
        );

        const messageText =
          newMessage.text ||
          newMessage.data?.text ||
          existingChat?.text ||
          '';

        const formattedMessage = {
          // Pertahankan semua data chat lama
          ...existingChat,

          // Data websocket terbaru
          ...newMessage,

          // Data utama
          jid: incomingJid,

          text: messageText,

          // DISPLAY NAME
          display_name:
            newMessage.display_name ||
            newMessage.data?.display_name ||
            existingChat?.display_name ||
            newMessage.pushName ||
            newMessage.data?.pushName ||
            existingChat?.pushName ||
            '',

          // AVATAR
          profile:
            newMessage.profile ||
            newMessage.data?.profile ||
            existingChat?.profile ||
            existingChat?.avatar ||
            newMessage.avatar ||
            newMessage.data?.avatar ||
            '',

          // Push name tetap dipertahankan
          pushName:
            newMessage.pushName ||
            newMessage.data?.pushName ||
            existingChat?.pushName ||
            '',

          timestamp:
            newMessage.timestamp ||
            newMessage.data?.timestamp ||
            existingChat?.timestamp ||
            new Date().toISOString(),

          fromMe: isFromMe,
        };

        const filteredChats = prevChats.filter(
          (chat) =>
            chat.jid?.toLowerCase() !==
            incomingJid.toLowerCase()
        );

        return [
          formattedMessage,
          ...filteredChats,
        ];
      });
    });

    sub.subscribe();

    return () => {
      sub.unsubscribe();
      sub.removeAllListeners();
    };
  }, [centrifuge]);

  return (
    <main className="relative h-screen min-h-0 overflow-hidden bg-black">
      <Users
        latestChats={latestChats}
        isFetching={isFetchingChats}
      />
    </main>
  );
};

export default React.memo(Home);