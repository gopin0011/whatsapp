import React from 'react';

interface SyncIndicatorProps {
  text?: string;
  position?: 'bottom-center' | 'bottom-right' | 'top-right';
}

const SyncIndicator: React.FC<SyncIndicatorProps> = ({ 
  text = "Menyinkronkan pesan...", 
  position = 'bottom-center' 
}) => {
  // Pengaturan posisi
  const positionClasses = {
    // bottom-20 agar mengapung di atas input chat/navigation bar Android
    'bottom-right': 'fixed bottom-20 right-5 pb-[env(safe-area-inset-bottom)]',
    'bottom-center': 'fixed bottom-20 left-1/2 -translate-x-1/2 pb-[env(safe-area-inset-bottom)]',
    'top-right': 'fixed top-4 right-4 pt-[env(safe-area-inset-top)]',
  };

  return (
    // <div className={`z-50 bg-[#202c33]/90 backdrop-blur-md text-[#00a884] text-xs px-4 py-2 rounded-full border border-[#00a884]/30 flex items-center gap-2.5 shadow-xl transition-all animate-fade-in ${positionClasses[position]}`}>
    //   <div className="w-3.5 h-3.5 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
    //   <span className="font-medium">{text}</span>
    // </div>
    <div
      title="Menyinkronkan pesan..."
      className={`z-[9999] w-9 h-9 rounded-full bg-[#202c33]/90 backdrop-blur-md border border-[#00a884]/40 flex items-center justify-center shadow-2xl transition-all pointer-events-none ${positionClasses[position]}`}
    >
      <div className="w-4 h-4 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default React.memo(SyncIndicator);