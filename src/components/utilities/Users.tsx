import React from 'react';
import { Users as GroupIcon, User as UserIcon } from 'lucide-react';
import UserSkeliton from '../reuse/UserSkeliton';

// Interface diperbarui sesuai dengan payload JSON dari backend JOIN
interface ChatItem {
  id?: string;
  instance: string;
  jid: string;
  pushName?: string;
  contactName?: string;
  displayName?: string;
  avatarUrl?: string;
  text: string;
  timestamp: string;
}

interface UsersProps {
  latestChats?: ChatItem[];
  isFetching?: boolean;
}

const Users: React.FC<UsersProps> = ({ latestChats = [], isFetching = false }) => {
  const formatTimestamp = (ts: string) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const skeliton = new Array(8).fill(0);

  return (
    <header className="w-full h-screen flex flex-col bg-[#111b21]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#222d34]">
        <h1 className="text-xl font-semibold text-white">Chats</h1>
      </div>

      {/* List Chat */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {isFetching ? (
          <div>
            {skeliton.map((_, index) => (
              <UserSkeliton key={index} />
            ))}
          </div>
        ) : latestChats.length > 0 ? (
          latestChats.map((chat) => {
            const isGroup = chat.jid.endsWith('@g.us');

            // 1. Prioritas Nama: displayName backend -> pushName -> Fallback Nomor JID
            const title =
              chat.displayName ||
              chat.contactName ||
              chat.pushName ||
              chat.jid.split('@')[0];

            // 2. Preview Pesan Terakhir Ala WA Web:
            // Jika di Group dan ada pushName pengirim, tampilkan "Nama: Pesan..."
            const lastMessagePreview =
              isGroup && chat.pushName
                ? `${chat.pushName}: ${chat.text}`
                : chat.text;

            return (
              <div
                key={chat.jid}
                className="p-3 bg-[#202c33] hover:bg-[#2a3942] rounded-lg cursor-pointer transition-all border border-[#222d34] flex items-center gap-3"
              >
                {/* Avatar / Gambar Profil */}
                {chat.avatarUrl ? (
                  <img
                    src={chat.avatarUrl}
                    alt={title}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className={`p-2.5 rounded-full flex-shrink-0 ${
                      isGroup
                        ? 'bg-indigo-900/50 text-indigo-400'
                        : 'bg-emerald-900/50 text-emerald-400'
                    }`}
                  >
                    {isGroup ? (
                      <GroupIcon className="w-5 h-5" />
                    ) : (
                      <UserIcon className="w-5 h-5" />
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h4 className="font-semibold text-sm text-gray-200 truncate">
                      {title}
                    </h4>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                      {formatTimestamp(chat.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate leading-relaxed">
                    {lastMessagePreview || (
                      <span className="italic text-gray-500">[Media/Gambar]</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-gray-500 text-sm mt-10">
            Tidak ada percakapan ditemukan.
          </div>
        )}
      </div>
    </header>
  );
};

export default React.memo(Users);