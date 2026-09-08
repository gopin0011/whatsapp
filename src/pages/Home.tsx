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

  // 1. Query reaktif spesifik BERDASARKAN INSTANCE yang aktif
  const latestChats = useLiveQuery(
    () => db.chats.where('instance').equals(instance).sortBy('timestamp').then(res => res.reverse()),
    [instance]
  );

  // 2. Sync Awal: Cek IndexedDB untuk instance ini
  useEffect(() => {
    const syncInitialHome = async () => {
      try {
        const count = await db.chats.where('instance').equals(instance).count();
        if (count === 0) {
          setIsSyncing(true);
          const baseUrl = import.meta.env.VITE_API_CLIENT_URL || 'http://localhost:8081';
          const response = await axios.get(`${baseUrl.replace(/\/$/, '')}/chats/sync`, {
            params: { 
              instance: instance
            }
          });

          if (response.data?.success) {
            const rawData = response.data.data || [];
            
            const formattedChats = rawData.map((item: any) => ({
              instance: instance, // Simpan ID instance
              jid: item.jid,
              text: item.text || item.message || '',
              timestamp: item.timestamp || item.date || new Date().toISOString(),
              fromMe: item.fromMe ?? item.isMyMsg ?? false,
              pushName: item.pushName || item.sender?.name,
              displayName: item.displayName || item.display_name || item.pushName || item.jid.split('@')[0],
              avatarUrl: item.avatarUrl || null,
            }));

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

  const isLoading = latestChats === undefined || isSyncing;

  return (
    <main className="relative h-screen min-h-0 overflow-hidden bg-black">
      <Users latestChats={latestChats || []} isFetching={isLoading} />
    </main>
  );
};

export default React.memo(Home);