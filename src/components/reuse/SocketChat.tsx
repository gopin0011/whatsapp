import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../Redux/store';
import { ConnectionResult, handleRecieveMessage, handleSetAllUsersChat, IMessage, setIsMsgsLoading } from '../../Redux/reducers/msg/MsgReducer';
import { Centrifuge } from "centrifuge";
import { UserState } from '../../Redux/reducers/Auth/AuthReducer';
import RecieveRingtone from "../../static/incomming_msg.wav"

// CENTRIFUGO: socket sekarang bisa null (lihat App.tsx context), semua hook di bawah wajib null-check di awal efek
export const useGetAllMsgs = (socket: Centrifuge | null, user: UserState) => {
    const dispatch: AppDispatch = useDispatch()

    useEffect(() => {
        let cancelled = false;

        const fetchMessages = async () => {
            if (!socket || socket.state !== 'connected' || user === null) return;

            dispatch(setIsMsgsLoading(true));
            try {
                // Backend harus punya RPC handler bernama "get_all_messages"
                const res = await socket.rpc("get_all_messages", { type: "message" });
                if (!cancelled) {
                    dispatch(handleSetAllUsersChat(res.data.connections));
                }
            } catch (error) {
                console.error("RPC get_all_messages gagal:", error);
            } finally {
                if (!cancelled) dispatch(setIsMsgsLoading(false));
            }
        };

        fetchMessages();

        return () => {
            cancelled = true;
        };
    }, [socket, user]);
};


export const useRecieveMessage = (socket: Centrifuge | null, friends: ConnectionResult[], currentUserIndex: null | number, userId: string) => {
    const dispatch: AppDispatch = useDispatch()
    const incomingMsgSound = useRef(new Audio(RecieveRingtone));

    useEffect(() => {
        if (!socket || socket.state !== 'connected' || !userId) return;

        const channelName = `personal:${userId}`;

        // Cek dulu apakah subscription sudah ada (idealnya sudah dibuat sekali di App.tsx setelah connect),
        // baru buat kalau ternyata belum ada — supaya hook ini tidak crash walau App.tsx belum sempat subscribe.
        let sub = socket.getSubscription(channelName);
        if (!sub) {
            sub = socket.newSubscription(channelName);
            sub.subscribe();
        }

        const handlePublication = (ctx: any) => {
            if (ctx.data.type === "recieve_message") {
                const data: IMessage = ctx.data.data;
                dispatch(handleRecieveMessage(data));
                if ((currentUserIndex !== null && data.room_id !== friends[currentUserIndex].room_id) || currentUserIndex === null) {
                    incomingMsgSound.current.currentTime = 0;
                    incomingMsgSound.current.play().catch((error) => {
                        console.error("Error playing the sound:", error);
                    });
                }
            }
        };

        sub.on('publication', handlePublication);

        return () => {
            sub?.off('publication', handlePublication);
            // Jangan unsubscribe/remove di sini kalau channel yang sama dipakai hook lain (update_msg, delete_msg)
        };
    }, [socket, userId, currentUserIndex, friends]);
}