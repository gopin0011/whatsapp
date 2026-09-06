import React, { useContext, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../Redux/store";
import { IMessage, updateChatMessage } from "../../Redux/reducers/msg/MsgReducer";
import { SocketContext } from "../../App";
import { toggleDeleteMessage } from "../../Redux/reducers/utils/Features";
import axios from "axios"; // CENTRIFUGO: pengganti socket.emit untuk aksi kirim (hapus pesan)

const DeleteConfirmationPopup = ({ message }: { message: IMessage }) => {
    const dispatch: AppDispatch = useDispatch();
    const { deleteMsg } = useSelector((store: RootState) => store.features);
    const { user } = useSelector((store: RootState) => store.auth); // CENTRIFUGO: perlu userId untuk nama channel
    const [isLoading, setIsLoading] = useState(false);

    // CENTRIFUGO: context sekarang bertipe Centrifuge | null
    const socket = useContext(SocketContext);

    // CENTRIFUGO: emit + ack diganti REST API. Backend menghapus pesan lalu mengembalikan
    // chat yang sudah terupdate di response, dan juga mem-publish "delete_msg" ke channel
    // personal user lain (mis. lawan chat) supaya perangkat mereka ikut ter-update.
    const handleDeleteMsg = async () => {
        setIsLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_CLIENT_URL}/messages/delete`, {
                message,
            });
            dispatch(updateChatMessage(res.data));
            dispatch(toggleDeleteMessage(false));
        } catch (error) {
            console.error("Gagal menghapus pesan:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // CENTRIFUGO: tidak subscribe baru di sini — ambil subscription channel personal yang
    // sudah dibuat sekali di App.tsx / dipakai bersama useRecieveMessage, lalu dengar tipe "delete_msg" saja.
    useEffect(() => {
        if (!socket || socket.state !== 'connected' || !user?._id) return;

        const sub = socket.getSubscription(`personal:${user._id}`);
        if (!sub) {
            console.warn('Subscription personal belum ada — pastikan sudah dibuat di App.tsx setelah connect');
            return;
        }

        const handlePublication = (ctx: any) => {
            if (ctx.data.type === "delete_msg") {
                dispatch(updateChatMessage(ctx.data.data));
                setIsLoading(false);
                dispatch(toggleDeleteMessage(false));
            }
        };

        sub.on('publication', handlePublication);

        return () => {
            sub.off('publication', handlePublication);
        };
    }, [socket, user?._id]);

    const cancelMsg = () => {
        setIsLoading(false);
        dispatch(toggleDeleteMessage(false));
    };

    return (
        <div className={`${deleteMsg === false ? "hidden" : "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"}`}>
            <div className="bg-gray-800 rounded-lg shadow-lg w-96 p-6">
                <h2 className="text-white text-lg font-semibold mb-4">Delete Chat?</h2>
                <p className="text-gray-400 mb-6">
                    Are you sure you want to delete this chat? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-4">
                    <button
                        className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-700 rounded hover:bg-gray-600 focus:outline-none"
                        onClick={cancelMsg}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-500 focus:outline-none"
                        onClick={handleDeleteMsg}
                    >
                        {isLoading ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(DeleteConfirmationPopup);