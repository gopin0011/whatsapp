import React, { useEffect, useState } from 'react';
import Users from '../components/utilities/Users';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../Redux/store'; // Sesuaikan path

const Home = () => {
  const [latestChats, setLatestChats] = useState<any[]>([]);
  const [isFetchingChats, setIsFetchingChats] = useState(false);

  // Ambil cache chat dari Redux
  const chatCache = useSelector((state: RootState) => state.chat.byJid);

  // FETCH CHAT AWAL DARI BACKEND
  useEffect(() => {
    const fetchLatestChats = async () => {
      try {
        setIsFetchingChats(true);
        const baseUrl = import.meta.env.VITE_API_CLIENT_URL || 'http://localhost:8081';
        const response = await axios.get(`${baseUrl}/getChat/wa-ninih`);

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

  // KETIKA ADA PESAN BARU MASUK DI REDUX -> UPDATE TAMPILAN DAFTAR USER
  useEffect(() => {
    // Kueri pesan terbaru dari Redux Cache untuk memperbarui daftar kontak di Home
    setLatestChats((prevChats) => {
      let updatedChats = [...prevChats];

      Object.keys(chatCache).forEach((jid) => {
        const messages = chatCache[jid];
        if (!messages || messages.length === 0) return;

        const lastMsg = messages[messages.length - 1];
        const raw = lastMsg.raw || {};

        const existingIndex = updatedChats.findIndex(
          (c) => c.jid?.toLowerCase() === jid.toLowerCase()
        );

        const updatedItem = {
          ...(existingIndex >= 0 ? updatedChats[existingIndex] : {}),
          jid: jid,
          text: lastMsg.message,
          timestamp: lastMsg.date,
          fromMe: lastMsg.isMyMsg,
          pushName: lastMsg.sender?.name,
          display_name: raw.display_name || lastMsg.sender?.name || jid.split('@')[0],
        };

        if (existingIndex >= 0) {
          updatedChats.splice(existingIndex, 1);
        }
        updatedChats.unshift(updatedItem);
      });

      return updatedChats;
    });
  }, [chatCache]);

  return (
    <main className="relative h-screen min-h-0 overflow-hidden bg-black">
      <Users latestChats={latestChats} isFetching={isFetchingChats} />
    </main>
  );
};

export default React.memo(Home);