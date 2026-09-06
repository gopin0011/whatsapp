import React, { useRef } from "react";
import { BiCheckDouble, BiCheck } from "react-icons/bi";
import { AiOutlineDown } from "react-icons/ai";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../Redux/store";
import useCloseDropDown from "../reuse/CloseDropDown";
import { Link } from "react-router-dom";
import { FaCircleChevronDown } from "react-icons/fa6";
import { handleEditMsg, handleSetReply, IMessage } from "../../Redux/reducers/msg/MsgReducer";
import { toggleDeleteMessage, toggleEditMessage } from "../../Redux/reducers/utils/Features";
import { LuTimer } from "react-icons/lu";

const Message = ({ message, color, scrollToMessage, index }: { message: IMessage, color: string, scrollToMessage: any, index: number }) => {
    const { currentUserIndex, friends } = useSelector((state: RootState) => state.msg);
    const [options, setOptions] = useCloseDropDown(false, '.dropdown');
    const messageRef = useRef<HTMLDivElement>(null);
    const dispatch: AppDispatch = useDispatch();

    // Helper untuk merender format sederhana (*bold*, _italic_, ~strike~, link)
    const parseFormatting = (text: string) => {
        const parts = text.split(/(https?:\/\/[^\s]+|\*[^*]+\*|_[^_]+_|\~[^~]+\~)/g);
        
        return parts.map((part, i) => {
            if (/^https?:\/\/[^\s]+$/.test(part)) {
                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#0000EE] hover:underline focus:outline-none">
                        {part}
                    </a>
                );
            } else if (/^\*[^*]+\*$/.test(part)) {
                return <strong key={i} className="font-bold">{part.slice(1, -1)}</strong>;
            } else if (/^_[^_]+_$/.test(part)) {
                return <em key={i} className="italic">{part.slice(1, -1)}</em>;
            } else if (/^\~[^~]+\~$/.test(part)) {
                return <del key={i} className="line-through">{part.slice(1, -1)}</del>;
            }
            return part;
        });
    };

    // Parser utama yang memecah baris berdasarkan '\n'
    function renderMessageWithLinks(message: IMessage) {
        if (!message.message) return null;

        if (message.message.includes("This message is deleted")) {
            return <span className="deleted-msg-style">{message.message}</span>;
        }

        // Memecah teks berdasarkan baris baru agar 'Enter' berfungsi sempurna
        const lines = message.message.split('\n');

        return lines.map((line, lineIdx) => (
            <React.Fragment key={lineIdx}>
                {parseFormatting(line)}
                {lineIdx < lines.length - 1 && <br />}
            </React.Fragment>
        ));
    }

    const handleToggleOptions = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        event.stopPropagation();
        setOptions(!options);
    };

    const handleTagReply = () => {
        dispatch(handleSetReply(message));
        setOptions(false);
    };

    const editMessage = () => {
        dispatch(toggleEditMessage(true));
        dispatch(handleEditMsg({ ...message, index: index }));
    };

    const deleteMessage = () => {
        dispatch(toggleDeleteMessage(true));
        dispatch(handleEditMsg({ ...message, index: index }));
    };

    return (
        <div ref={messageRef} id={`message-${message._id ? message._id : index}`} className={`flex ${message.isMyMsg === true ? null : "flex-row-reverse"}`}>
            <div className={`${message.isMyMsg === true
                ? "ml-auto bg-[#008069] rounded-tl-md rounded-bl-md rounded-br-md"
                : "bg-[#233138] rounded-tr-md rounded-br-md rounded-bl-md mr-auto"
                } group relative text-[.91rem] w-fit max-w-sm text-[#ededef] px-2 py-1`}>

                <h3 className={`${message.isMyMsg === true ? "hidden" : message.conn_type === 'group' ? `block ${color}` : "hidden"} font-Rubik tracking-wide font-[500] text-[.91rem]`}>
                    ~ {message?.sender.name ? message.sender.name : message.sender.mobile}
                </h3>

                {message.replyFor && (
                    <a href="#" onClick={() => scrollToMessage(message.replyFor?.id)} className={`${message.isMyMsg === true ? "bg-[#2e3f3a] border-[#06cf9c]" : "bg-[#2e3f3a] border-[#53bdeb]"} max-w-sm flex flex-col bg-opacity-50 justify-center px-1 py-2 mb-1 rounded-lg font-[450] border-l-4`}>
                        <p className={`${message.isMyMsg === true ? "text-[#06cf9c]" : "text-[#53bdeb]"} text-[.91rem] font-semibold line-clamp-1`}>{message.replyFor?.name}</p>
                        <p className={`${message.isMyMsg === true ? "text-[#ffffff99]" : "text-slate-500"} text-[.91rem] line-clamp-1`}>{message.replyFor?.message}</p>
                    </a>
                )}

                {/* whitespace-pre-wrap dan break-words memastikan pindah baris & kata panjang ter-wrap */}
                <div className="whitespace-pre-wrap break-words inline-block">
                    {renderMessageWithLinks(message)}
                </div>

                <span className="flex h-fit w-fit ml-auto items-end justify-end mt-1">
                    <span className="text-[10px] text-[#ffffff99]">
                        {new Date(message.date).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            hour12: true,
                            minute: "numeric",
                        })}
                        {
                            message.send === false ?
                                <LuTimer size={15} className={`${message.isMyMsg === true ? "inline text-[#ffffff99]" : "hidden"}`} />
                                :
                                message.seen === true ? <BiCheckDouble className={`${message.isMyMsg === true ? "inline text-[#4FB6EC]" : "hidden"}`} size={20} /> :
                                    friends[currentUserIndex]?.online_status === true ?
                                        <BiCheckDouble className={`${message.isMyMsg === true ? "inline text-[#ffffff99]" : "hidden"}`} size={20} /> :
                                        <BiCheck className={`${message.isMyMsg === true ? "inline text-[#f0f2f5]" : "hidden"}`} size={20} />
                        }
                    </span>
                    <span className={`${message.isMyMsg === true ? "bg-[#008069]" : "bg-[#233138]"} 
                    absolute top-0 right-2 group-hover:translate-y-0 translate-y-5 group-hover:visible invisible transition-all shadow-sm
                     shadow-black p-1 rounded-b-full sm:cursor-pointer`} onClick={handleToggleOptions}>
                        <AiOutlineDown size={15} />
                    </span>
                </span>

                <div style={message.isMyMsg === true ? { top: 0, right: 50 } : { top: 0, left: 100 }}
                    className={`${options ? "scale-y-100 opacity-100 translate-x-0" : "scale-y-0 translate-x-10 w-0 opacity-0"} msgOptions`}>
                    <div>
                        <button onClick={handleTagReply} className="options" role="menuitem">
                            <span>reply</span>
                            <FaCircleChevronDown className="inline font-Rubik" />
                        </button>
                        {message.isMyMsg === true &&
                            <button onClick={editMessage} className="options" role="menuitem">edit</button>
                        }
                        {message.isMyMsg === true &&
                            <button onClick={deleteMessage} className="options" role="menuitem">Delete Me</button>
                        }
                        <Link to="#" className="options">delete All</Link>
                        <button className="options" role="menuitem">Close Chat</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Message;