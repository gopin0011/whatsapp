import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";

import { useSelector, useDispatch } from "react-redux";
import { useParams } from "react-router-dom";
import { db } from "../../db/chatDb";
import { useSocket } from "../../context/SocketContext";

import Message from "../cards/Message";
import { RootState } from "../../Redux/store";

import { FcContacts } from "react-icons/fc";
import { IoMdPhotos } from "react-icons/io";
import { AiOutlineCamera } from "react-icons/ai";
import { MdPoll } from "react-icons/md";
import { PiStickerDuotone } from "react-icons/pi";
import { IoDocumentTextOutline } from "react-icons/io5";

import { setShowAttachFiles } from "../../Redux/reducers/utils/utilReducer";
import ImageComp from "./ImageComp";
import { openfullScreen } from "../../Redux/reducers/utils/Features";
import { formatDate } from "../cards/ReUseFunc";
import { recieveColors } from "../../static/Static";
import Audio from "./Audio";
import IncomingCall from "../cards/IncommingCall";
import { ChevronDown } from "lucide-react";
import ShowFullImg from "./ShowFullImg";
import SyncIndicator from '../reuse/SyncIndicator';

const getRandomColors = (
  count: number,
  recieveColors: Record<string, string>
): string[] => {
  const colors = Object.keys(recieveColors);
  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    const randomColorIndex = Math.floor(Math.random() * colors.length);
    result.push(recieveColors[colors[randomColorIndex]]);
  }

  return result;
};

interface ChatPageProps {
  instance?: string;
  scrollToMessage?: (messageId: string) => void;
  handleOffer?: () => void;
  rejectCall?: () => void;
}

const ChatPage: React.FC<ChatPageProps> = ({
  instance = "wa-ninih",
  scrollToMessage = () => {},
  handleOffer = () => {},
  rejectCall = () => {},
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const dispatch = useDispatch();
  const { jid } = useParams<{ jid: string }>();
  const { isSyncing } = useSocket();

  const realJid = useMemo(() => {
    if (!jid) return "";
    let decoded = jid;
    try {
      decoded = atob(jid);
    } catch (e) {
      decoded = jid;
    }
    return decoded.trim();
  }, [jid]);

  const chatContentRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const mediaBaseUrl = import.meta.env.VITE_API_CLIENT_URL || "http://192.168.100.245:8082";

  const formatMediaUrl = (
    urlPath: string | null | undefined, 
    isThumb: boolean = false, 
    msgType: string = 'text'
  ): string => {
    if (!urlPath) return "";
    if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
      return urlPath;
    }
    
    let fileName = urlPath.split("/").pop() || "";
    const isAudio = ['audio', 'voice', 'ptt'].includes(msgType);

    if (isThumb && !isAudio) {
      if (msgType === 'video') {
        fileName = fileName.replace(/\.[^/.]+$/, "") + ".jpg";
      }
      return `${mediaBaseUrl.replace(/\/$/, "")}/media/thumb/${fileName}`;
    }
    
    return `${mediaBaseUrl.replace(/\/$/, "")}/media/${fileName}`;
  };

  const transformMessage = (msg: any) => {
    let rawType = (msg.msgType || msg.mediaType || "text").toLowerCase();

    let normalizedType = "text";
    if (rawType.includes("image")) normalizedType = "image";
    else if (rawType.includes("video")) normalizedType = "video";
    else if (rawType.includes("audio") || rawType.includes("voice") || rawType.includes("ptt")) normalizedType = "audio";
    else if (rawType.includes("sticker")) normalizedType = "sticker";

    return {
      _id: msg.id,
      id: msg.id,
      instance: msg.instance,
      jid: msg.jid,
      message: msg.message || msg.text || "",
      date: msg.timestamp,
      timestamp: msg.timestamp,
      isMyMsg: msg.isMyMsg,
      msgType: normalizedType,
      file: formatMediaUrl(msg.file || msg.mediaUrl, false, normalizedType),
      thumbUrl: formatMediaUrl(msg.thumbUrl || msg.file || msg.mediaUrl, true, normalizedType),
      sender: msg.sender || { name: msg.jid?.split("@")[0] || "Unknown" },
    };
  };

  const getScrollContainer = () => {
    return chatContentRef.current?.parentElement as HTMLDivElement | null;
  };

  // 1. INITIAL FETCH PESAN DARI DEXIE
  useEffect(() => {
    let isMounted = true;
    if (!realJid) return;

    const loadInitialMessages = async () => {
      setIsInitialLoading(true);
      
      const allMatching = await db.messages
        .where("instance")
        .equals(instance)
        .filter((msg) => msg.jid === realJid)
        .toArray();

      allMatching.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (!isMounted) return;

      const PAGE_SIZE = 50;
      const totalCount = allMatching.length;
      
      if (totalCount <= PAGE_SIZE) {
        setHasMore(false);
        const formatted = allMatching.map(transformMessage);
        setMessages(formatted);
        setOffset(0);
      } else {
        setHasMore(true);
        const startIndex = totalCount - PAGE_SIZE;
        const initialChunk = allMatching.slice(startIndex);
        const formatted = initialChunk.map(transformMessage);
        setMessages(formatted);
        setOffset(startIndex);
      }

      setIsInitialLoading(false);
    };

    loadInitialMessages();

    return () => {
      isMounted = false;
    };
  }, [realJid, instance]);

  // 2. FUNGSI APPEND/PREPEND UNTUK MEMUAT PESAN SEBELUMNYA
  const handleLoadMoreClick = async () => {
    const container = getScrollContainer();
    if (!container || isFetchingMore || !hasMore || offset <= 0) return;

    setIsFetchingMore(true);
    const prevScrollHeight = container.scrollHeight;

    const PAGE_SIZE = 50;
    const newOffset = Math.max(0, offset - PAGE_SIZE);

    const allMatching = await db.messages
      .where("instance")
      .equals(instance)
      .filter((msg) => msg.jid === realJid)
      .toArray();

    allMatching.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const olderChunk = allMatching.slice(newOffset, offset);
    const formattedOlder = olderChunk.map(transformMessage);

    // APPEND PESAN LAMA KE BAGIAN ATAS ARRAY (PREPENDING STATE)
    setMessages((prev) => [...formattedOlder, ...prev]);
    setOffset(newOffset);

    if (newOffset === 0) {
      setHasMore(false);
    }

    // MENJAGA POSISI SCROLL DENGAN PRESISI TANPA LONCATAN
    requestAnimationFrame(() => {
      if (container) {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop = newScrollHeight - prevScrollHeight;
      }
      setIsFetchingMore(false);
    });
  };

  const { showAttachFiles } = useSelector((state: RootState) => state.utils);
  const { startCall } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight;

      setShowScrollButton(distanceFromBottom > 300);
    };

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToBottom = () => {
    const container = getScrollContainer();
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });

    setShowScrollButton(false);
  };

  const currChatImages = useMemo(() => {
    return messages.filter((msg) => msg?.msgType === "image");
  }, [messages]);

  const colors = useMemo(() => {
    return getRandomColors(messages.length, recieveColors);
  }, [messages.length]);

  const isFirstMessageOfDay = (currentMessage: any, previousMessage: any) => {
    if (!previousMessage) return true;

    const currentDate = new Date(currentMessage.date);
    const previousDate = new Date(previousMessage.date);

    return currentDate.toDateString() !== previousDate.toDateString();
  };

  const handleShowBigImg = (message: any) => {
    const targetUrl = message.file || message.thumbUrl;
    const formattedImages = currChatImages.map((img) => ({
      ...img,
      file: img.file || img.thumbUrl,
    }));

    const clickedImageIndex = formattedImages.findIndex(
      (img) => img._id === message._id || img.id === message.id
    );

    dispatch(
      openfullScreen({
        images: formattedImages,
        currentImage: targetUrl,
        isFullscreen: true,
        zoomLevel: 1,
        currentIndex: clickedImageIndex !== -1 ? clickedImageIndex : 0,
      })
    );
  };

  const handleUploadImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    dispatch(setShowAttachFiles(false));
  };

  return (
    <div
      ref={chatContentRef}
      className="relative w-full min-h-full bg-transparent text-white"
    >
      {isSyncing && (
        <SyncIndicator position="bottom-center" />
      )}

      {startCall?.call && (
        <div className="absolute z-[20] top-0 left-0 right-0 w-full p-2">
          <IncomingCall
            acceptCall={handleOffer}
            rejectOnClick={rejectCall}
            imageUrl={null}
          />
        </div>
      )}

      <div className="sm:px-16 px-5 py-5 sm:py-5 space-y-3 min-h-full bg-transparent">
        
        {!isInitialLoading && messages.length > 0 && hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={handleLoadMoreClick}
              disabled={isFetchingMore}
              className="text-xs bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] hover:text-[#02b890] px-4 py-1.5 rounded-full transition-all border border-[#00a884]/30 flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isFetchingMore ? (
                <>
                  <div className="w-3 h-3 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
                  <span>Memuat pesan lama...</span>
                </>
              ) : (
                <span>Muat pesan sebelumnya</span>
              )}
            </button>
          </div>
        )}

        {isInitialLoading ? (
          <div className="text-center text-gray-400 py-10 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Memuat percakapan...</span>
          </div>
        ) : messages.length > 0 ? (
          messages.map((message: any, index: number) => (
            <div key={message._id || index}>
              {isFirstMessageOfDay(
                message,
                index > 0 ? messages[index - 1] : null
              ) && (
                <div className="flex justify-center items-center my-2">
                  <div className="text-center text-[.81rem] bg-[#111b21] py-2 px-2 text-[#8696a0] rounded-lg uppercase">
                    {formatDate(message.date)}
                  </div>
                </div>
              )}

              {message.msgType === "notification" && (
                <p className="notification">{message.message}</p>
              )}

              {message.msgType === "text" && (
                <Message
                  key={message._id || index}
                  message={message}
                  color={colors[index] as string}
                  scrollToMessage={scrollToMessage}
                  index={index}
                />
              )}

              {message.msgType === "image" && (
                <ImageComp
                  key={message._id || index}
                  onClick={() => handleShowBigImg(message)}
                  message={{
                    ...message,
                    displayUrl: message.thumbUrl || message.file,
                  }}
                />
              )}

              {message.msgType === "video" && (
                <VideoMessage key={index} message={message} />
              )}

              {(message.msgType === "audio" ||
                message.msgType === "voice" ||
                message.msgType === "ptt") && (
                <Audio
                  key={index}
                  onClick={() => handleShowBigImg(message)}
                  color={colors[index] as string}
                  message={message}
                />
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-10">
            Belum ada pesan di percakapan ini.
          </div>
        )}

        <div
          aria-orientation="vertical"
          aria-labelledby="menu-button"
          className={`attachedFiles ${
            showAttachFiles === true ? "scale-x-100" : "scale-x-0"
          }`}
          role="menu"
        >
          <div className="py-1 px-3 sm:cursor-pointer" role="none">
            <div className="hover:bg-[#111b21] rounded-md text-[#ffffff] flex gap-3 items-center py-1.5 px-2">
              <IoDocumentTextOutline size={20} className="text-[#9185ce]" />
              <input type="file" id="document" className="hidden" multiple />
              <label htmlFor="document" className="text-md text-white sm:cursor-pointer">
                document
              </label>
            </div>

            <div className="hover:bg-[#111b21] rounded-md text-white flex gap-3 items-center py-1.5 px-2">
              <IoMdPhotos size={20} className="text-[#007bfc]" />
              <input
                id="photosvideos"
                multiple
                type="file"
                accept=".jpg,.jpeg,.png"
                className="hidden"
                onChange={handleUploadImages}
              />
              <label htmlFor="photosvideos" className="text-md text-white sm:cursor-pointer">
                photos & videos
              </label>
            </div>

            <div className="hover:bg-[#111b21] rounded-md text-white flex gap-3 items-center py-1.5 px-2">
              <AiOutlineCamera size={20} className="text-[#c78399]" />
              <p className="text-md">camera</p>
            </div>

            <div className="hover:bg-[#111b21] rounded-md text-white flex gap-3 items-center py-1.5 px-2">
              <FcContacts size={20} />
              <p className="text-md">contact</p>
            </div>

            <div className="hover:bg-[#111b21] rounded-md text-white flex gap-3 items-center py-1.5 px-2">
              <MdPoll size={20} className="text-[#ffbc38]" />
              <p className="text-md">poll</p>
            </div>

            <div className="hover:bg-[#111b21] rounded-md text-white flex gap-3 items-center py-1.5 px-2">
              <PiStickerDuotone size={20} className="text-[#02a698]" />
              <input type="file" id="sticker" className="hidden" />
              <label htmlFor="sticker" className="text-md text-white cursor-pointer">
                sticker
              </label>
            </div>
          </div>
        </div>

        {showScrollButton && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="fixed bottom-20 right-6 z-[50] w-10 h-10 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-[#aebac1] shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 border border-[#2a3942]"
          >
            <ChevronDown size={20} />
          </button>
        )}

        <ShowFullImg />
      </div>
    </div>
  );
};

export default React.memo(ChatPage);

// KOMPONEN VIDEO MESSAGE
const VideoMessage: React.FC<{ message: any }> = ({ message }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [imgError, setImgError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const mediaBaseUrl =
    import.meta.env.VITE_API_CLIENT_URL || "http://192.168.100.245:8082";

  const videoUrl = message.file?.startsWith("http")
    ? message.file
    : `${mediaBaseUrl.replace(/\/$/, "")}${message.file}`;

  const thumbUrl = message.thumbUrl?.startsWith("http")
    ? message.thumbUrl
    : `${mediaBaseUrl.replace(/\/$/, "")}${message.thumbUrl}`;

  const handlePlayClick = () => {
    setIsPlaying(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play();
      }
    }, 50);
  };

  const formattedTime = new Date(
    message.timestamp || message.date
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const hasCustomCaption =
    message.message &&
    !["🎥 Video", "📷 Foto", "📄 Dokumen", "🎨 Stiker"].includes(
      message.message.trim()
    );

  return (
    <div
      className={`flex ${
        message.isMyMsg ? "justify-end" : "justify-start"
      } my-1`}
    >
      <div
        className={`relative w-[280px] sm:w-[320px] p-1.5 rounded-lg shadow-sm ${
          message.isMyMsg ? "bg-[#005c4b]" : "bg-[#202c33]"
        }`}
      >
        {!isPlaying ? (
          <div
            onClick={handlePlayClick}
            className="relative w-full h-[320px] sm:h-[360px] bg-[#111b21] rounded-md overflow-hidden cursor-pointer group border border-[#222d34]/40"
          >
            {thumbUrl && !imgError ? (
              <>
                <img
                  src={thumbUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-40 z-0"
                />
                <div className="absolute inset-0 bg-black/20 z-0" />
                <img
                  src={thumbUrl}
                  alt="Video Thumbnail"
                  onError={() => setImgError(true)}
                  className="absolute inset-0 m-auto max-w-full max-h-full object-contain z-10 transition-transform duration-300 group-hover:scale-105"
                />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs z-0">
                No Thumbnail
              </div>
            )}

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 group-hover:bg-black/80 flex items-center justify-center transition-all group-hover:scale-110 z-30 border border-white/30 backdrop-blur-md shadow-lg">
              <div className="w-0 h-0 border-t-[7px] border-t-transparent border-l-[13px] border-l-white border-b-[7px] border-b-transparent ml-1" />
            </div>

            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-[10px] px-2 py-0.5 rounded text-white/90 font-medium z-30 flex items-center gap-1 border border-white/10">
              <span>▶</span> Video
            </div>

            {!hasCustomCaption && (
              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white/90 z-30 border border-white/10">
                {formattedTime}
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-[320px] sm:h-[360px] bg-black rounded-md overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              preload="metadata"
              className="w-full h-full object-contain"
            >
              Browser tidak mendukung video.
            </video>
          </div>
        )}

        {hasCustomCaption ? (
          <div className="flex justify-between items-end gap-2 pt-1.5 px-1">
            <p className="text-sm text-white/90 break-words leading-tight">
              {message.message}
            </p>
            <span className="text-[10px] text-white/60 whitespace-nowrap self-end">
              {formattedTime}
            </span>
          </div>
        ) : isPlaying ? (
          <div className="flex justify-end pt-1 px-1">
            <span className="text-[10px] text-white/60">{formattedTime}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};