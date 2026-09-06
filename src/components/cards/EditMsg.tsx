import React, { useContext } from "react";
import { RxCross1 } from "react-icons/rx";
import { AiOutlineCheck } from "react-icons/ai";
import { BiCheckDouble } from "react-icons/bi";
import { useSelector, useDispatch } from "react-redux";
import { toggleEditMessage } from "../../Redux/reducers/utils/Features"
import { AppDispatch, RootState } from "../../Redux/store";
import { ChatMessage, updateChatMessage } from "../../Redux/reducers/msg/MsgReducer";
import { useEffect, useState } from "react";
import { ClipLoader } from "react-spinners"
import axios from "axios"; // CENTRIFUGO: pengganti socket.emit untuk aksi kirim (edit pesan)

import { SocketContext } from "../../App";
const EditMsg = ({ message }: { message: ChatMessage }) => {
    const dispatch: AppDispatch = useDispatch()
    // CENTRIFUGO: context sekarang bertipe Centrifuge | null
    const socket = useContext(SocketContext);
    const { user } = useSelector((store: RootState) => store.auth); // CENTRIFUGO: perlu userId untuk nama channel
    const [msg, setMsg] = useState(message?.message)
    const [isLoading, setIsLoading] = useState(false)
    useEffect(() => {
        setMsg(message?.message)
    }, [message?.message])

    const { editmsg } = useSelector((store: RootState) => store.features);
    const handleChangeMsg = (e: any) => {
        setMsg(e.target.value)
    }

    // CENTRIFUGO: emit + ack diganti REST API. Backend mengupdate pesan lalu mengembalikan
    // chat yang sudah terupdate di response, dan mem-publish "update_msg" ke channel personal
    // lawan chat supaya perangkat mereka ikut ter-update.
    const handleUpdateMsg = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_CLIENT_URL}/messages/edit`, {
                ...message,
                message: msg,
            });
            dispatch(updateChatMessage(res.data));
            dispatch(toggleEditMessage(false));
        } catch (error) {
            console.error("Gagal mengedit pesan:", error);
        } finally {
            setIsLoading(false);
        }
    }

    // CENTRIFUGO: tidak subscribe baru di sini — ambil subscription channel personal yang
    // sudah dibuat sekali di App.tsx / dipakai bersama useRecieveMessage & DeleteMsg, lalu
    // dengar tipe "update_msg" saja.
    useEffect(() => {
        if (!socket || socket.state !== 'connected' || !user?._id) return;

        const sub = socket.getSubscription(`personal:${user._id}`);
        if (!sub) {
            console.warn('Subscription personal belum ada — pastikan sudah dibuat di App.tsx setelah connect');
            return;
        }

        const handlePublication = (ctx: any) => {
            if (ctx.data.type === "update_msg") {
                dispatch(updateChatMessage(ctx.data.data));
                setIsLoading(false);
                dispatch(toggleEditMessage(false));
            }
        };

        sub.on('publication', handlePublication);

        return () => {
            sub.off('publication', handlePublication);
        };
    }, [socket, user?._id])
    return (
        <>
            <div
                className={`fixed z-10 top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 transition-all delay-75 duration-150 ${editmsg === true ? "scale-100 " : "scale-0  "}  `}>
                <div className="min-w-[150px] w-[550px] backImg bg-black shadow-md shadow-black">
                    <div className="bg-[#202c33] flex justify-start items-center h-[50px] gap-1 w-full" >
                        <div className="icons" onClick={() => dispatch(toggleEditMessage(false))}>
                            <RxCross1 title="Cancel" className="text-white cursor-pointer" />
                        </div>
                        <span className="text-white  font-Rubik">Edit Message</span>
                    </div>
                    <div className=" bg-black bg-opacity-80 flex items-center justify-center min-h-[190px]">
                        <p className="mx-auto bg-[#008069] text-[.91rem] max-w-sm  text-[#ededef]  rounded-md px-2 py-1 ">
                            <span className="break-words line-clamp-1">{message?.message} </span>
                            <span className=" line-clamp-1 flex h-fit w-fit ml-auto items-end justify-end">
                                <span className="text-[10px] text-[#ffffff99]">
                                    {new Date(message?.date).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        hour12: true,
                                        minute: "numeric",
                                    })}
                                    <BiCheckDouble className="inline text-[#4FB6EC]" size={20} />
                                </span>
                            </span>
                        </p>
                    </div>
                    <form onSubmit={handleUpdateMsg} className="bg-[#111b21] h-[60px] px-4 flex gap-6 items-center justify-center  bottom-0 w-full">
                        <div className="w-full rounded-lg flex items-center ml-5">
                            <input
                                type="text" value={msg} onChange={handleChangeMsg}
                                placeholder="type a message"
                                className="text-white focus:outline-none h-10 font-Rubik text-[1rem] bg-[#2a3942] px-5 py-4 rounded-lg w-full"
                            />
                        </div>
                        <div className="flex w-10 items-center justify-center">
                            {
                                isLoading === true ?
                                    <ClipLoader
                                        color="#36d7b7"
                                        loading={isLoading}
                                        aria-label="Loading Spinner"
                                        speedMultiplier={.71}
                                        data-testid="loader"
                                    />
                                    :
                                    <button className="flex gap-3" type="submit">
                                        <AiOutlineCheck
                                            className="text-panel-header-icon cursor-pointer w-9 h-9 p-1 bg-[#008069] rounded-full text-white text-xl"
                                            title="send"
                                        />
                                    </button>
                            }

                        </div>

                    </form>
                </div>
            </div>
            <div className={` ${editmsg === true ? "transition-all delay-75  bg-opacity-50 w-screen fixed h-screen bg-black" : null} `}>
            </div >
        </ >
    );
};

export default React.memo(EditMsg);