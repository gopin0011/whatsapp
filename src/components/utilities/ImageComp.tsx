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
  const { currentUserIndex, friends } = useSelector((state: RootState) => state.msg);

  // Gunakan thumbUrl / displayUrl jika ada, fallback ke message.file (mediaUrl)
  const srcUrl = (message.displayUrl || message.thumbUrl || message.file) as string;

  return (
    <section 
      className={`${message.isMyMsg === true ? "bg-[#02a698] ml-auto" : "bg-[#233138] mr-auto"} relative rounded-lg p-1 w-fit my-1 cursor-pointer`}
      onClick={onClick}
    >
      <div className="z-0 relative">
        <img 
          src={srcUrl} 
          loading="lazy" 
          alt="Chat Attachment" 
          className="max-w-[320px] max-h-[340px] min-w-[200px] flex-grow-0 flex-shrink-0 transition-[filter] duration-150 ease-linear rounded-lg object-cover" 
        />

        {/* Teks caption/pesan jika ada */}
        {message.message && message.message !== "📷 Foto" && (
          <p className="text-sm text-white px-1 pt-1.5 break-words max-w-[320px]">
            {message.message}
          </p>
        )}

        {/* Timestamp & Status Centang */}
        <div className="absolute bottom-1 right-1 flex items-end gap-1 bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
          <span className="text-[#e9edef] text-[11px] pt-1 min-w-fit font-medium">
            {new Date(message.date).toLocaleTimeString("en-US", {
              hour: "numeric",
              hour12: true,
              minute: "numeric",
            })}
          </span>
          <span className="text-[#8696a0]">
            {message.send === false ? (
              <LuTimer size={15} className={`${message.isMyMsg === true ? "inline text-[#ffffff99]" : "hidden"}`} />
            ) : message.seen === true ? (
              <BiCheckDouble className={`${message.isMyMsg === true ? "inline text-[#4FB6EC]" : "hidden"}`} size={20} />
            ) : friends[currentUserIndex]?.online_status === true ? (
              <BiCheckDouble className={`${message.isMyMsg === true ? "inline text-[#ffffff99]" : "hidden"}`} size={20} />
            ) : (
              <BiCheck className={`${message.isMyMsg === true ? "inline text-[#f0f2f5]" : "hidden"}`} size={20} />
            )}
          </span>
        </div>
      </div>
    </section>
  );
};

export default ImageComp;