import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/chatDb';
import Users from '../components/utilities/Users';
import { useSocket } from '../context/SocketContext';

interface HomeProps {
  instance?: string;
}

const Home: React.FC<HomeProps> = ({ instance = 'wa-ninih' }) => {
  // Ambil state isSyncing langsung dari SocketContext
  const { isSyncing } = useSocket();

  // Query reaktif spesifik BERDASARKAN INSTANCE yang aktif
  const latestChats = useLiveQuery(
    () => db.chats.where('instance').equals(instance).sortBy('timestamp').then(res => res.reverse()),
    [instance]
  );

  // Loading aktif jika data dari IndexedDB masih undefined ATAU SocketContext sedang melakukan sync HTTP
  const isLoading = latestChats === undefined || isSyncing;

  return (
    <main className="relative h-screen min-h-0 overflow-hidden bg-black">
      <Users latestChats={latestChats || []} isFetching={isLoading} />
    </main>
  );
};

export default React.memo(Home);