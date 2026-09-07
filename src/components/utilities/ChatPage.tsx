import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";

import { useSelector, useDispatch } from "react-redux";
import { useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/chatDb";

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
  const dispatch = useDispatch();
  const { jid } = useParams<{ jid: string }>();

  const realJid = useMemo(() => {
    if (!jid) return "";
    try {
      return atob(jid);
    } catch (e) {
      return jid;
    }
  }, [jid]);

  const [loadingApi, setLoadingApi] = useState(false);
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
    
    const fileName = urlPath.split("/").pop() || "";
    const isAudio = ['audio', 'voice', 'ptt'].includes(msgType);

    if (isThumb && !isAudio) {
      return `${mediaBaseUrl.replace(/\/$/, "")}/media/thumb/${fileName}`;
    }
    
    return `${mediaBaseUrl.replace(/\/$/, "")}/media/${fileName}`;
  };

  // =========================================================
  // AMBIL PESAN DARI DEXIE (undefined SAAT LOADING awal)
  // =========================================================
  const rawMessages = useLiveQuery(
    () => db.messages.where("jid").equals(realJid).sortBy("timestamp"),
    [realJid]
  );

  // Status loading IndexedDB
  const isDexieLoading = rawMessages === undefined;

  const messages = useMemo(() => {
    if (!rawMessages) return [];
    return rawMessages.map((msg: any) => {
      const type = msg.msgType || "text";
      return {
        _id: msg.id,
        id: msg.id,
        jid: msg.jid,
        message: msg.message,
        date: msg.timestamp,
        timestamp: msg.timestamp,
        isMyMsg: msg.isMyMsg,
        msgType: type,
        file: formatMediaUrl(msg.file || msg.mediaUrl, false, type),
        thumbUrl: formatMediaUrl(msg.thumbUrl || msg.file || msg.mediaUrl, true, type),
        sender: msg.sender || { name: msg.jid?.split("@")[0] || "Unknown" },
      };
    });
  }, [rawMessages, mediaBaseUrl]);

  const { showAttachFiles } = useSelector((state: RootState) => state.utils);
  const { startCall } = useSelector((state: RootState) => state.auth);

  // =========================================================
  // FETCH HISTORY JIKA DEXIE KOSONG
  // =========================================================
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!realJid || isDexieLoading) return;

      // Cek jika di IndexedDB memang tidak ada data
      if (messages.length === 0) {
        try {
          setLoadingApi(true);
          const baseUrl = import.meta.env.VITE_API_CLIENT_URL || "http://localhost:8081";
          const response = await axios.get(
            `${baseUrl}/chat/${encodeURIComponent(realJid)}?instance=${instance}`
          );

          if (response.data?.success) {
            const formattedMessages = response.data.data.map((chat: any) => ({
              id: chat.id || chat._id || new Date().getTime().toString(),
              jid: chat.jid || realJid,
              message: chat.text || chat.message || "",
              timestamp: chat.timestamp || chat.date || new Date().toISOString(),
              isMyMsg: chat.fromMe ?? chat.isMyMsg ?? false,
              msgType: chat.mediaType || chat.msgType || "text",
              file: chat.mediaUrl || chat.file,
              thumbUrl: chat.thumbUrl || chat.mediaUrl || chat.file,
              sender: {
                name:
                  chat.pushName ||
                  chat.sender?.name ||
                  realJid.split("@")[0] ||
                  "Unknown",
              },
            }));

            await db.messages.bulkPut(formattedMessages);
          }
        } catch (error) {
          console.error("Gagal memuat riwayat pesan:", error);
        } finally {
          setLoadingApi(false);
        }
      }
    };

    fetchChatHistory();
  }, [realJid, instance, isDexieLoading, messages.length]);

  // =========================================================
  // FIX: LOGIKA INITIAL LOADING
  // =========================================================
  const isInitialLoading = isDexieLoading || (loadingApi && messages.length === 0);

  const getScrollContainer = () => {
    return chatContentRef.current?.parentElement as HTMLDivElement | null;
  };

  useEffect(() => {
    if (!messages.length) return;

    requestAnimationFrame(() => {
      const container = getScrollContainer();
      if (!container) return;

      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "auto",
        });

        setShowScrollButton(false);
      });
    });
  }, [messages.length, jid]);

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
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [messages.length, jid]);

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
      {/* INCOMING CALL */}
      {startCall?.call && (
        <div className="absolute z-[20] top-0 left-0 right-0 w-full p-2">
          <IncomingCall
            acceptCall={handleOffer}
            rejectOnClick={rejectCall}
            imageUrl={null}
          />
        </div>
      )}

      {/* MESSAGE CONTENT */}
      <div className="sm:px-16 px-5 py-5 sm:py-5 space-y-3 min-h-full bg-transparent">
        {isInitialLoading ? (
          <div className="text-center text-gray-400 py-10 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Memuat percakapan...</span>
          </div>
        ) : messages.length > 0 ? (
          messages.map((message: any, index: number) => (
            <div key={message._id || index}>
              {/* DATE */}
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

              {/* NOTIFICATION */}
              {message.msgType === "notification" && (
                <p className="notification">{message.message}</p>
              )}

              {/* TEXT */}
              {message.msgType === "text" && (
                <Message
                  key={message._id || index}
                  message={message}
                  color={colors[index] as string}
                  scrollToMessage={scrollToMessage}
                  index={index}
                />
              )}

              {/* IMAGE */}
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

              {/* VIDEO */}
              {message.msgType === "video" && (
                <VideoMessage key={index} message={message} />
              )}

              {/* AUDIO */}
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

        {/* ATTACHMENT PANEL */}
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

        {/* SCROLL DOWN BUTTON */}
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

const VideoMessage: React.FC<{ message: any }> = ({ message }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoUrl = message.file?.startsWith("http")
    ? message.file
    : `${import.meta.env.VITE_API_CLIENT_URL || "http://localhost:8081"}${message.file}`;

  const handlePlayClick = () => {
    setIsPlaying(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play();
      }
    }, 50);
  };

  return (
    <div className={`flex ${message.isMyMsg ? "justify-end" : "justify-start"} my-1`}>
      <div
        className={`relative w-[320px] sm:w-[380px] p-1.5 rounded-lg ${
          message.isMyMsg ? "bg-[#005c4b]" : "bg-[#202c33]"
        }`}
      >
        {!isPlaying ? (
          <div
            onClick={handlePlayClick}
            className="relative w-full aspect-video bg-[#111b21] rounded-md flex items-center justify-center cursor-pointer group overflow-hidden border border-[#222d34]"
          >
            <div className="w-14 h-14 rounded-full bg-black/60 group-hover:bg-black/80 flex items-center justify-center transition-all group-hover:scale-110 z-10 border border-white/20">
              <div className="w-0 h-0 border-t-[9px] border-t-transparent border-l-[16px] border-l-white border-b-[9px] border-b-transparent ml-1" />
            </div>
            <span className="absolute bottom-2 right-2 bg-black/70 text-[11px] px-2 py-0.5 rounded text-white/80 font-medium">
              Video
            </span>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            preload="auto"
            className="w-full h-auto max-h-[400px] rounded-md object-contain bg-black"
          >
            Browser tidak mendukung video.
          </video>
        )}

        {message.message && (
          <p className="text-sm text-white px-1 pt-1.5 break-words">
            {message.message}
          </p>
        )}
      </div>
    </div>
  );
};