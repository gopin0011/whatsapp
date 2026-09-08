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
    'bottom-center': 'absolute bottom-6 left-1/2 -translate-x-1/2',
    'bottom-right': 'absolute bottom-6 right-6',
    'top-right': 'fixed top-3 right-3',
  };

  return (
    <div className={`z-50 bg-[#202c33]/90 backdrop-blur-md text-[#00a884] text-xs px-4 py-2 rounded-full border border-[#00a884]/30 flex items-center gap-2.5 shadow-xl transition-all animate-fade-in ${positionClasses[position]}`}>
      <div className="w-3.5 h-3.5 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
      <span className="font-medium">{text}</span>
    </div>
  );
};

export default React.memo(SyncIndicator);