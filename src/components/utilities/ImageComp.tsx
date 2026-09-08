import React from "react";
import { BiCheck, BiCheckDouble } from "react-icons/bi";
import { RootState } from "../../Redux/store";
import { useSelector } from "react-redux";
import { IMessage } from "../../Redux/reducers/msg/MsgReducer";
import { LuTimer } from "react-icons/lu";

interface ImageCompProps {
  message: IMessage & { displayUrl?: string; thumbUrl?: string };
  onClick?: () => void;
}

const ImageComp: React.FC<ImageCompProps> = ({ onClick, message }) => {
  const { currentUserIndex, friends } = useSelector(
    (state: RootState) => state.msg
  );

  // Gambar Utama (HD) & Gambar Thumbnail (Kecil/Ringan)
  const fullUrl = (message.file || message.displayUrl || message.thumbUrl) as string;
  const thumbUrl = (message.thumbUrl || message.displayUrl || message.file) as string;

  const hasCustomCaption =
    message.message &&
    !["📷 Foto", "🎥 Video", "📄 Dokumen", "🎨 Stiker"].includes(
      message.message.trim()
    );

  return (
    <section
      className={`${
        message.isMyMsg === true ? "bg-[#005c4b] ml-auto" : "bg-[#202c33] mr-auto"
      } relative rounded-lg p-1.5 w-fit my-1 cursor-pointer max-w-[280px] sm:max-w-[330px] shadow-sm`}
      onClick={onClick}
    >
      {/* FRAME CONTANER DENGAN DOUBLE IMAGE / BACKGROUND BLUR */}
      <div className="relative w-full h-[240px] sm:h-[280px] bg-[#111b21] rounded-md overflow-hidden flex items-center justify-center border border-[#222d34]/40">
        
        {/* 1. LAYER BACKGROUND (BLUR & FIT COVER) */}
        <img
          src={thumbUrl}
          loading="lazy"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-60"
        />

        {/* OVERLAY DARK UNTUK MENJAGA KONTRAS */}
        <div className="absolute inset-0 bg-black/20" />

        {/* 2. LAYER FOREGROUND (GAMBAR UTAMA DITENGAH) */}
        <img
          src={fullUrl}
          loading="lazy"
          alt="Chat Attachment"
          className="relative z-10 max-w-full max-h-full object-contain transition-transform duration-200 hover:scale-[1.01]"
        />

        {/* OVERLAY TIMESTAMP & STATUS (JIKA TIDAK ADA CAPTION) */}
        {!hasCustomCaption && (
          <div className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded text-white/90 backdrop-blur-md">
            <span className="text-[10px] font-medium">
              {new Date(message.date).toLocaleTimeString("en-US", {
                hour: "numeric",
                hour12: true,
                minute: "numeric",
              })}
            </span>
            <span className="text-[#8696a0]">
              {message.send === false ? (
                <LuTimer
                  size={13}
                  className={`${
                    message.isMyMsg ? "inline text-[#ffffff99]" : "hidden"
                  }`}
                />
              ) : message.seen === true ? (
                <BiCheckDouble
                  className={`${
                    message.isMyMsg ? "inline text-[#4FB6EC]" : "hidden"
                  }`}
                  size={16}
                />
              ) : friends[currentUserIndex]?.online_status === true ? (
                <BiCheckDouble
                  className={`${
                    message.isMyMsg ? "inline text-[#ffffff99]" : "hidden"
                  }`}
                  size={16}
                />
              ) : (
                <BiCheck
                  className={`${
                    message.isMyMsg ? "inline text-[#f0f2f5]" : "hidden"
                  }`}
                  size={16}
                />
              )}
            </span>
          </div>
        )}
      </div>

      {/* TERTULIS CAPTION JIKA ADA */}
      {hasCustomCaption && (
        <div className="flex justify-between items-end gap-2 pt-1.5 px-1">
          <p className="text-sm text-white/90 break-words leading-tight max-w-[220px] sm:max-w-[260px]">
            {message.message}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-white/60">
              {new Date(message.date).toLocaleTimeString("en-US", {
                hour: "numeric",
                hour12: true,
                minute: "numeric",
              })}
            </span>
            <span className="text-[#8696a0]">
              {message.send === false ? (
                <LuTimer
                  size={13}
                  className={`${
                    message.isMyMsg ? "inline text-[#ffffff99]" : "hidden"
                  }`}
                />
              ) : message.seen === true ? (
                <BiCheckDouble
                  className={`${
                    message.isMyMsg ? "inline text-[#4FB6EC]" : "hidden"
                  }`}
                  size={16}
                />
              ) : friends[currentUserIndex]?.online_status === true ? (
                <BiCheckDouble
                  className={`${
                    message.isMyMsg ? "inline text-[#ffffff99]" : "hidden"
                  }`}
                  size={16}
                />
              ) : (
                <BiCheck
                  className={`${
                    message.isMyMsg ? "inline text-[#f0f2f5]" : "hidden"
                  }`}
                  size={16}
                />
              )}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};

export default React.memo(ImageComp);