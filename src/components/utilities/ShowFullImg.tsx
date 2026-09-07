import React, { useCallback, useEffect, useState } from 'react';
import { AiOutlineLeft, AiOutlineRight } from 'react-icons/ai';
import { RxCross2 } from 'react-icons/rx';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../Redux/store';
import { 
  setCurrentImage, 
  setIsFullscreen, 
  setZoomLevel, 
  setCurrentIndex 
} from '../../Redux/reducers/utils/Features';

const ShowFullImg = () => {
  const dispatch: AppDispatch = useDispatch();
  
  // Pastikan membaca dari slice state yang benar (features)
  const { currentImage, isFullscreen, zoomLevel, currentIndex, images } = useSelector(
    (state: RootState) => state.features
  );

  const [imageUrl, setImageUrl] = useState<string>('');
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // 1. Dapatkan URL string dari currentImage (File, Blob, atau String URL)
  useEffect(() => {
    if (!currentImage) {
      setImageUrl('');
      return;
    }

    if (currentImage instanceof File || currentImage instanceof Blob) {
      const objectUrl = URL.createObjectURL(currentImage);
      setImageUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl); // Clean up memory
    } else if (typeof currentImage === 'string') {
      setImageUrl(currentImage);
    }
  }, [currentImage]);

  // 2. Handle Scroll Zoom (Hanya aktif saat modal terbuka)
  const handleScroll = useCallback(
    (e: WheelEvent) => {
      if (!isFullscreen) return;
      const delta = e.deltaY;
      const newZoomLevel = zoomLevel + (delta > 0 ? -0.2 : 0.2);
      const constrainedZoom = Math.max(0.5, Math.min(newZoomLevel, 4));
      dispatch(setZoomLevel(constrainedZoom));
    },
    [dispatch, isFullscreen, zoomLevel]
  );

  useEffect(() => {
    if (isFullscreen) {
      window.addEventListener('wheel', handleScroll);
    }
    return () => {
      window.removeEventListener('wheel', handleScroll);
    };
  }, [handleScroll, isFullscreen]);

  // 3. Handle Drag / Pan Image
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
      if (e.buttons === 1 && zoomLevel > 1) {
        setPosition((prev) => ({
          x: prev.x + e.movementX,
          y: prev.y + e.movementY,
        }));
      }
    },
    [zoomLevel]
  );

  // 4. Close Modal
  const closeFullscreen = () => {
    dispatch(setCurrentImage(null));
    dispatch(setIsFullscreen(false));
    dispatch(setZoomLevel(1));
    dispatch(setCurrentIndex(null)); // FIX: Ditambahkan dispatch()
    setPosition({ x: 0, y: 0 });
  };

  // Helper untuk mengambil URL dari object gambar di array
  const getImageUrlFromItem = (item: any) => {
    if (!item) return '';
    return item.file || item.mediaUrl || item.displayUrl || item.thumbUrl || '';
  };

  // 5. Next Image
  const nextImage = () => {
    if (currentIndex !== null && images && currentIndex < images.length - 1) {
      const nextIdx = currentIndex + 1;
      setPosition({ x: 0, y: 0 });
      dispatch(setZoomLevel(1));
      dispatch(setCurrentIndex(nextIdx));
      dispatch(setCurrentImage(getImageUrlFromItem(images[nextIdx])));
    }
  };

  // 6. Prev Image
  const prevImage = () => {
    if (currentIndex !== null && images && currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setPosition({ x: 0, y: 0 });
      dispatch(setZoomLevel(1));
      dispatch(setCurrentIndex(prevIdx));
      dispatch(setCurrentImage(getImageUrlFromItem(images[prevIdx])));
    }
  };

  if (!isFullscreen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center select-none backdrop-blur-sm">
      {/* Container Image */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <img
          draggable={false}
          onMouseMove={handleMouseMove}
          src={imageUrl}
          alt="Fullscreen View"
          style={{
            transform: `scale(${zoomLevel}) translate(${position.x}px, ${position.y}px)`,
            transition: zoomLevel === 1 ? 'transform 0.2s ease-out' : 'none',
          }}
          className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing"
        />

        {/* Close Button */}
        <button
          type="button"
          className="absolute top-5 right-5 p-2.5 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full transition z-10"
          onClick={closeFullscreen}
          title="Tutup"
        >
          <RxCross2 size={24} />
        </button>

        {/* Prev Button */}
        {currentIndex !== null && currentIndex > 0 && (
          <button
            type="button"
            className="absolute left-5 p-3 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full transition z-10"
            onClick={prevImage}
            title="Sebelumnya"
          >
            <AiOutlineLeft size={24} />
          </button>
        )}

        {/* Next Button */}
        {currentIndex !== null && images && currentIndex < images.length - 1 && (
          <button
            type="button"
            className="absolute right-5 p-3 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full transition z-10"
            onClick={nextImage}
            title="Berikutnya"
          >
            <AiOutlineRight size={24} />
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(ShowFullImg);