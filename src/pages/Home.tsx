import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/chatDb';
import Users from '../components/utilities/Users';
import axios from 'axios';
import { toast } from 'react-toastify';

interface HomeProps {
  instance?: string;
}

const Home: React.FC<HomeProps> = ({ instance = 'wa-ninih' }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Query reaktif dari Dexie IndexedDB (Diurutkan berdasarkan pesan terbaru)
  const latestChats = useLiveQuery(
    () => db.chats.orderBy('timestamp').reverse().toArray(),
    []
  );

  // 2. Sync Awal: Ambil data dari Backend HANYA jika IndexedDB masih kosong
  useEffect(() => {
    const syncInitialHome = async () => {
      try {
        const count = await db.chats.count();
        if (count === 0) {
          setIsSyncing(true);
          const baseUrl = import.meta.env.VITE_API_CLIENT_URL || 'http://localhost:8081';
          const response = await axios.get(`${baseUrl}/chats/latest/${instance}`);

          if (response.data?.success) {
            const rawData = response.data.data || [];
            
            // Mapping format data agar sesuai dengan schema ChatItem di Dexie
            const formattedChats = rawData.map((item: any) => ({
              jid: item.jid,
              text: item.text || item.message || '',
              timestamp: item.timestamp || item.date || new Date().toISOString(),
              fromMe: item.fromMe ?? item.isMyMsg ?? false,
              pushName: item.pushName || item.sender?.name,
              displayName: item.displayName || item.display_name || item.pushName || item.jid.split('@')[0],
              avatarUrl: item.avatarUrl || null,
            }));

            // Simpan secara massal ke Dexie
            await db.chats.bulkPut(formattedChats);
          }
        }
      } catch (error) {
        console.error('Gagal menyinkronkan daftar chat awal:', error);
        toast.error('Gagal memuat pesan');
      } finally {
        setIsSyncing(false);
      }
    };

    syncInitialHome();
  }, [instance]);

  // Tampilkan indikator loading jika Dexie masih inisialisasi query pertamanya
  const isLoading = latestChats === undefined || isSyncing;

  return (
    <main className="relative h-screen min-h-0 overflow-hidden bg-black">
      <Users latestChats={latestChats || []} isFetching={isLoading} />
    </main>
  );
};

export default React.memo(Home);