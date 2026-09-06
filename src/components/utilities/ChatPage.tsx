import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";

import { useSelector, useDispatch } from "react-redux";
import { useParams, useLocation } from "react-router-dom";
import axios from "axios";

import Message from "../cards/Message";

import { AppDispatch, RootState } from "../../Redux/store";

import { FcContacts } from "react-icons/fc";
import { IoMdPhotos } from "react-icons/io";
import { AiOutlineCamera } from "react-icons/ai";
import { MdPoll } from "react-icons/md";
import { PiStickerDuotone } from "react-icons/pi";
import { IoDocumentTextOutline } from "react-icons/io5";

import {
  setShowAttachFiles,
} from "../../Redux/reducers/utils/utilReducer";

import ImageComp from "./ImageComp";

import {
  openfullScreen,
} from "../../Redux/reducers/utils/Features";

import {
  formatDate,
} from "../cards/ReUseFunc";

import {
  recieveColors,
} from "../../static/Static";

import Audio from "./Audio";
import IncomingCall from "../cards/IncommingCall";

import { ChevronDown } from "lucide-react";
import { useSocket } from "../../context/SocketContext";

const getRandomColors = (
  count: number,
  recieveColors: Record<string, string>
): string[] => {

  const colors = Object.keys(recieveColors);
  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    const randomColorIndex =
      Math.floor(Math.random() * colors.length);

    result.push(
      recieveColors[colors[randomColorIndex]]
    );
  }

  return result;
};


interface ChatPageProps {
  scrollToMessage?: (messageId: string) => void;
  handleOffer?: () => void;
  rejectCall?: () => void;
}


interface ChatLocationState {
  jid?: string;
  display_name?: string;
  pushName?: string;
  profile?: string;
  avatar?: string;
}


const ChatPage: React.FC<ChatPageProps> = ({
  scrollToMessage = () => {},
  handleOffer = () => {},
  rejectCall = () => {},
}) => {

  const dispatch: AppDispatch = useDispatch();

  const { jid } = useParams<{ jid: string }>();

  const realJid = useMemo(() => {
    if (!jid) return "";
    try {
      return atob(jid); // Mengubah "MTIzQGcudXM=" kembali jadi "123@g.us"
    } catch (e) {
      // Fallback jika URL tidak ter-encode dengan benar
      return jid; 
    }
  }, [jid]);

  const location = useLocation();

  const chatState =
    (location.state as ChatLocationState | null) || null;


  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const chatContentRef =
    useRef<HTMLDivElement | null>(null);

  const [showScrollButton, setShowScrollButton] =
    useState(false);


  const {
    showAttachFiles,
  } = useSelector(
    (state: RootState) => state.utils
  );

  const {
    startCall,
  } = useSelector(
    (state: RootState) => state.auth
  );

  const { centrifuge } = useSocket(); 

  // =========================================================
  // REALTIME CENTRIFUGO UNTUK CHAT PAGE
  // =========================================================
  useEffect(() => {
    if (!centrifuge || !jid) return;

    const channelName = 'whatsapp:messages';
    const currentJid = decodeURIComponent(jid).toLowerCase();

    // 1. Cek atau buat subscription
    let sub = centrifuge.getSubscription(channelName);
    if (!sub) {
      sub = centrifuge.newSubscription(channelName);
    }

    // 2. Handler saat ada pesan baru masuk via WebSocket
    const handlePublication = (ctx: any) => {
      const newMessage = ctx.data;
      const incomingJid = (newMessage.jid || newMessage.data?.jid || '').toLowerCase();

      // Pastikan pesan yang masuk berasal dari percakapan (JID) yang sedang dibuka
      if (incomingJid && incomingJid === currentJid) {
        const formattedMsg = {
          _id: newMessage.id || newMessage.key?.id || new Date().getTime().toString(),
          message: newMessage.text || newMessage.data?.text || '',
          date: newMessage.timestamp || newMessage.data?.timestamp || new Date().toISOString(),
          isMyMsg: newMessage.fromMe ?? newMessage.data?.fromMe ?? false,
          msgType: newMessage.mediaType || 'text',
          file: newMessage.mediaUrl,
          sender: {
            name:
              newMessage.pushName ||
              newMessage.data?.pushName ||
              incomingJid.split('@')[0] ||
              'Unknown',
          },
        };

        // Append pesan baru ke state messages
        setMessages((prev) => {
          // Cegah pesan duplikat berdasarkan ID
          const isExist = prev.some((m) => m._id === formattedMsg._id);
          if (isExist) return prev;
          return [...prev, formattedMsg];
        });
      }
    };

    // 3. Pasang listener
    sub.on('publication', handlePublication);

    if (sub.state === 'unsubscribed') {
      sub.subscribe();
    }

    // 4. Cleanup saat komponen unmount atau JID berganti
    return () => {
      if (sub) {
        sub.off('publication', handlePublication);
      }
    };
  }, [centrifuge, jid]);


  // =========================================================
  // FETCH CHAT HISTORY
  // =========================================================
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!realJid) return;

      try {
        setLoading(true);
        const baseUrl = import.meta.env.VITE_API_CLIENT_URL || "http://localhost:8081";

        const response = await axios.get(
          `${baseUrl}/chat/${encodeURIComponent(realJid)}?instance=wa-ninih`
        );

        if (response.data?.success) {

          const formattedMessages =
            response.data.data.map(
              (chat: any) => ({
                _id: chat.id,

                message: chat.text,

                date: chat.timestamp,

                isMyMsg: chat.fromMe,

                msgType:
                  chat.mediaType || "text",

                file: chat.mediaUrl,

                sender: {
                  name:
                    chat.pushName ||
                    chat.jid?.split("@")[0] ||
                    "Unknown",
                },
              })
            );


          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("Gagal memuat riwayat pesan:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
  }, [realJid]);


  // =========================================================
  // AMBIL SCROLL CONTAINER MILIK CHAT.TSX
  // =========================================================

  const getScrollContainer = () => {

    return chatContentRef.current
      ?.parentElement as HTMLDivElement | null;

  };


  // =========================================================
  // AUTO SCROLL KE PESAN PALING BAWAH
  // =========================================================

  useEffect(() => {

    if (!messages.length) return;

    requestAnimationFrame(() => {

      const container =
        getScrollContainer();

      if (!container) return;

      requestAnimationFrame(() => {

        container.scrollTo({
          top: container.scrollHeight,
          behavior: "auto",
        });

        setShowScrollButton(false);
      });

    });

  }, [messages, jid]);


  // =========================================================
  // DETEKSI POSISI SCROLL
  // =========================================================

  useEffect(() => {

    const container =
      getScrollContainer();

    if (!container) return;


    const handleScroll = () => {

      const distanceFromBottom =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight;

      setShowScrollButton(
        distanceFromBottom > 300
      );
    };


    container.addEventListener(
      "scroll",
      handleScroll
    );

    handleScroll();


    return () => {

      container.removeEventListener(
        "scroll",
        handleScroll
      );

    };

  }, [messages, jid]);


  // =========================================================
  // SCROLL KE BAWAH
  // =========================================================

  const scrollToBottom = () => {

    const container =
      getScrollContainer();

    if (!container) return;


    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });


    setShowScrollButton(false);
  };


  // =========================================================
  // FILTER GAMBAR
  // =========================================================

  const currChatImages = useMemo(() => {

    return messages.filter(
      (msg) =>
        msg?.msgType === "image"
    );

  }, [messages]);


  // =========================================================
  // RANDOM COLORS
  // =========================================================

  const colors = useMemo(() => {

    return getRandomColors(
      messages.length,
      recieveColors
    );

  }, [messages.length]);


  // =========================================================
  // HEADER TANGGAL
  // =========================================================

  const isFirstMessageOfDay = (
    currentMessage: any,
    previousMessage: any
  ) => {

    if (!previousMessage) return true;

    const currentDate =
      new Date(currentMessage.date);

    const previousDate =
      new Date(previousMessage.date);

    return (
      currentDate.toDateString() !==
      previousDate.toDateString()
    );
  };


  // =========================================================
  // FULLSCREEN IMAGE
  // =========================================================

  const handleShowBigImg = (
    message: any
  ) => {

    const clickedImageIndex =
      currChatImages.findIndex(
        (img) =>
          img.date === message.date
      );


    dispatch(
      openfullScreen({
        images: currChatImages,

        currentImage: message.file,

        isFullscreen: true,

        zoomLevel: 1,

        currentIndex:
          clickedImageIndex,
      })
    );
  };


  // =========================================================
  // UPLOAD IMAGE
  // =========================================================

  const handleUploadImages = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    if (!e.target.files) return;

    dispatch(
      setShowAttachFiles(false)
    );

    // TODO:
    // Upload media ke backend
  };


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      ref={chatContentRef}
      className="
        relative
        w-full
        min-h-full
        bg-transparent
        text-white
      "
    >
      {/* =====================================================
          INCOMING CALL
      ===================================================== */}
      {startCall?.call && (
        <div
          className="
            absolute
            z-[20]
            top-0
            left-0
            right-0
            w-full
            p-2
          "
        >
          <IncomingCall
            acceptCall={handleOffer}
            rejectOnClick={rejectCall}
            imageUrl={null}
          />
        </div>
      )}

      {/* =====================================================
          MESSAGE CONTENT
      ===================================================== */}
      <div
        className="
          sm:px-16
          px-5
          py-5
          sm:py-5
          space-y-3
          min-h-full
          bg-transparent
        "
      >

        {loading ? (

          <div
            className="
              text-center
              text-gray-400
              py-10
            "
          >
            Memuat pesan...
          </div>

        ) : messages.length > 0 ? (

          messages.map(
            (
              message: any,
              index: number
            ) => (

              <div
                key={
                  message._id ||
                  index
                }
              >

                {/* DATE */}

                {isFirstMessageOfDay(
                  message,
                  index > 0
                    ? messages[index - 1]
                    : null
                ) && (

                  <div
                    className="
                      flex
                      justify-center
                      items-center
                      my-2
                    "
                  >

                    <div
                      className="
                        text-center
                        text-[.81rem]
                        bg-[#111b21]
                        py-2
                        px-2
                        text-[#8696a0]
                        rounded-lg
                        uppercase
                      "
                    >
                      {formatDate(
                        message.date
                      )}
                    </div>

                  </div>

                )}


                {/* NOTIFICATION */}

                {message.msgType ===
                  "notification" && (

                  <p className="notification">
                    {message.message}
                  </p>

                )}


                {/* TEXT */}

                {message.msgType ===
                  "text" && (

                  <Message
                    key={
                      message._id ||
                      index
                    }

                    message={message}

                    color={
                      colors[index] as string
                    }

                    scrollToMessage={
                      scrollToMessage
                    }

                    index={index}
                  />

                )}


                {/* IMAGE */}

                {message.msgType ===
                  "image" && (

                  <ImageComp
                    key={index}

                    onClick={() =>
                      handleShowBigImg(
                        message
                      )
                    }

                    message={message}
                  />

                )}

                {/* VIDEO COMPONENT (LAZY LOADED ON CLICK) */}
                {message.msgType === "video" && (
                  <VideoMessage key={index} message={message} />
                )}

                {/* AUDIO */}
                {(
                  message.msgType ===
                    "audio" ||
                  message.msgType ===
                    "voice" ||
                  message.msgType ===
                    "ptt"
                ) && (

                  <Audio
                    key={index}

                    onClick={() =>
                      handleShowBigImg(
                        message
                      )
                    }

                    color={
                      colors[index] as string
                    }

                    message={message}
                  />

                )}

              </div>

            )
          )

        ) : (

          <div
            className="
              text-center
              text-gray-500
              py-10
            "
          >
            Belum ada pesan di
            percakapan ini.
          </div>

        )}


        {/* ===================================================
            ATTACHMENT PANEL
        =================================================== */}

        <div
          aria-orientation="vertical"
          aria-labelledby="menu-button"
          className={`
            attachedFiles
            ${
              showAttachFiles === true
                ? "scale-x-100"
                : "scale-x-0"
            }
          `}
          role="menu"
        >

          <div
            className="
              py-1
              px-3
              sm:cursor-pointer
            "
            role="none"
          >

            {/* DOCUMENT */}

            <div
              className="
                hover:bg-[#111b21]
                rounded-md
                text-white
                flex
                gap-3
                items-center
                py-1.5
                px-2
              "
            >

              <IoDocumentTextOutline
                size={20}
                className="text-[#9185ce]"
              />

              <input
                type="file"
                id="document"
                className="hidden"
                multiple
              />

              <label
                htmlFor="document"
                className="
                  text-md
                  text-white
                  sm:cursor-pointer
                "
              >
                document
              </label>

            </div>


            {/* PHOTO */}

            <div
              className="
                hover:bg-[#111b21]
                rounded-md
                text-white
                flex
                gap-3
                items-center
                py-1.5
                px-2
              "
            >

              <IoMdPhotos
                size={20}
                className="text-[#007bfc]"
              />

              <input
                id="photosvideos"
                multiple
                type="file"
                accept=".jpg,.jpeg,.png"
                className="hidden"
                onChange={
                  handleUploadImages
                }
              />

              <label
                htmlFor="photosvideos"
                className="
                  text-md
                  text-white
                  sm:cursor-pointer
                "
              >
                photos & videos
              </label>

            </div>


            {/* CAMERA */}

            <div
              className="
                hover:bg-[#111b21]
                rounded-md
                text-white
                flex
                gap-3
                items-center
                py-1.5
                px-2
              "
            >

              <AiOutlineCamera
                size={20}
                className="text-[#c78399]"
              />

              <p className="text-md">
                camera
              </p>

            </div>


            {/* CONTACT */}

            <div
              className="
                hover:bg-[#111b21]
                rounded-md
                text-white
                flex
                gap-3
                items-center
                py-1.5
                px-2
              "
            >

              <FcContacts
                size={20}
              />

              <p className="text-md">
                contact
              </p>

            </div>


            {/* POLL */}

            <div
              className="
                hover:bg-[#111b21]
                rounded-md
                text-white
                flex
                gap-3
                items-center
                py-1.5
                px-2
              "
            >

              <MdPoll
                size={20}
                className="text-[#ffbc38]"
              />

              <p className="text-md">
                poll
              </p>

            </div>


            {/* STICKER */}

            <div
              className="
                hover:bg-[#111b21]
                rounded-md
                text-white
                flex
                gap-3
                items-center
                py-1.5
                px-2
              "
            >

              <PiStickerDuotone
                size={20}
                className="text-[#02a698]"
              />

              <input
                type="file"
                id="sticker"
                className="hidden"
              />

              <label
                htmlFor="sticker"
                className="
                  text-md
                  text-white
                  cursor-pointer
                "
              >
                sticker
              </label>

            </div>

          </div>

        </div>


        {/* ===================================================
            SCROLL DOWN BUTTON
        =================================================== */}

        {showScrollButton && (

          <button
            type="button"
            onClick={
              scrollToBottom
            }
            className="
              fixed
              bottom-20
              right-6
              z-[50]
              w-10
              h-10
              rounded-full
              bg-[#202c33]
              hover:bg-[#2a3942]
              text-[#aebac1]
              shadow-lg
              flex
              items-center
              justify-center
              transition-all
              duration-200
              hover:scale-105
              border
              border-[#2a3942]
            "
            aria-label="Scroll ke pesan terbaru"
            title="Ke pesan terbaru"
          >

            <ChevronDown
              size={20}
            />

          </button>

        )}

      </div>

    </div>
  );
};


export default React.memo(
  ChatPage
);

// Sub-komponen khusus Video agar render super cepat
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
          /* TAMPILAN AWAL LEBIH BESAR (ASPECT VIDEO) */
          <div
            onClick={handlePlayClick}
            className="relative w-full aspect-video bg-[#111b21] rounded-md flex items-center justify-center cursor-pointer group overflow-hidden border border-[#222d34]"
          >
            {/* Play Button */}
            <div className="w-14 h-14 rounded-full bg-black/60 group-hover:bg-black/80 flex items-center justify-center transition-all group-hover:scale-110 z-10 border border-white/20">
              <div className="w-0 h-0 border-t-[9px] border-t-transparent border-l-[16px] border-l-white border-b-[9px] border-b-transparent ml-1" />
            </div>

            {/* Indicator Video */}
            <span className="absolute bottom-2 right-2 bg-black/70 text-[11px] px-2 py-0.5 rounded text-white/80 font-medium">
              Video
            </span>
          </div>
        ) : (
          /* SAAT DI-PLAY */
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

        {/* CAPTION (HANYA MUNCUL JIKA ADA) */}
        {message.message && (
          <p className="text-sm text-white px-1 pt-1.5 break-words">
            {message.message}
          </p>
        )}
      </div>
    </div>
  );
};