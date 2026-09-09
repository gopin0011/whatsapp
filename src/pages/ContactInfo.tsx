import React from "react"
import { AppDispatch, RootState } from '../Redux/store';
import { useDispatch, useSelector } from 'react-redux';
import { RxCross2 } from 'react-icons/rx';
import { FaCircleUser } from 'react-icons/fa6';
import { MdDelete } from "react-icons/md";
import { MdBlock } from "react-icons/md";
import { FaThumbsDown } from "react-icons/fa";
import UserCard from '../components/cards/UserCard';
import { ChatUser, setCurrentGrpOrUser, toggleContactInfo } from "../Redux/reducers/msg/MsgReducer";
import { openfullScreen } from "../Redux/reducers/utils/Features";
import { handleProfileOpen } from "../Redux/reducers/utils/utilReducer";
import { maskPhoneNumber } from "../components/cards/ReUseFunc";
import { getAvatarUrl } from '../utils/avatar';

const ContactInfo = () => {
    const dispatch: AppDispatch = useDispatch();
    const { currentUserIndex, friends, contactInfo } = useSelector((state: RootState) => state.msg)

    const currentFriend = friends[currentUserIndex];

    const closeContact = () => {
        dispatch(toggleContactInfo(false))
    }

    let onClickUser = (user: ChatUser) => {
        const friendIndex = friends.map((friend) => friend.users?.includes(user))
        if (friendIndex) {
            dispatch(setCurrentGrpOrUser(friendIndex))
        } else {
            dispatch(handleProfileOpen(true))
        }
    }

    // 🟢 AMBIL AVATAR URL LENGKAP
    const fullAvatarUrl = getAvatarUrl(currentFriend?.profile || (currentFriend as any)?.avatarUrl);

    const ShowFullImage = () => {
        if (fullAvatarUrl) {
            dispatch(openfullScreen({ 
                currentImage: fullAvatarUrl, 
                isFullscreen: true, 
                zoomLevel: 1, 
                currentIndex: 0 
            }));
        }
    }

    // 🟢 FORMAT DISPLAY NAME (Konsisten dengan Users.tsx)
    const rawName = currentFriend?.displayName || 
                    (currentFriend as any)?.pushName || 
                    currentFriend?.display_name || 
                    currentFriend?.jid?.split('@')[0] || 
                    '';

    const formattedTitle = Number(rawName) ? maskPhoneNumber(rawName) : rawName;

    return (
        <div className={`max-h-screen h-screen md:max-w-[350px] border-l border-black flex flex-col bg-black text-white absolute top-0 right-0 w-full transition-all ease-linear duration-300 delay-150 ${contactInfo === true ? "-translate-x-0 z-20" : "translate-x-full"}`}>
            <div className='h-16 gap-2 sm:gap-5 px-4 py-3 flex items-center bg-[#202c33]'>
                <div onClick={closeContact} className="top-4 left-4 w-fit p-3 icons cursor-pointer">
                    <RxCross2 size={25} className="text-white" title="cancel" />
                </div>
                <p className='text-[1rem] font-[450]'>Contact Info</p>
            </div>
            <div className='overflow-y-auto space-y-3 custom-scrollbar h-full'>
                <div className='p-5 bg-[#111b21] space-y-5 sm:cursor-pointer'>
                    <div className='flex justify-center items-center'>
                        {/* 🟢 TAMPILAN AVATAR TERPERBAIKI */}
                        {fullAvatarUrl ? (
                            <img 
                                onClick={ShowFullImage} 
                                src={fullAvatarUrl} 
                                className="group cursor-pointer rounded-full h-[200px] w-[200px] object-cover" 
                                alt="Profile" 
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        ) : (
                            <div className="p-1">
                                <FaCircleUser size={200} className="text-slate-400" />
                            </div>
                        )}
                    </div>
                    <div>
                        {/* 🟢 DISPLAY NAME TERPERBAIKI */}
                        <h3 className='text-[#d1d7db] font-Rubik tracking-wider text-[1.2rem] text-center'>
                            {formattedTitle}
                        </h3>
                        <p className='text-center text-[#667181] font-Rubik text-sm mt-1'>
                            {currentFriend?.conn_type === "group" || currentFriend?.jid?.endsWith('@g.us')
                                ? `Group • ${currentFriend?.users?.length || 0} members` 
                                : `~ ${currentFriend?.pushName || formattedTitle}`}
                        </p>
                    </div>
                </div>
                <div className='p-4 px-8 bg-[#111b21]'>
                    <p className='text-[#8696a0] text-[.91rem]'>About</p>
                    <h4>{currentFriend?.about ? currentFriend?.about : 'No about for this user'}</h4>
                </div>
                <div className=''>
                    {
                        currentFriend?.users && currentFriend?.users?.slice().reverse().map((user, index) => {
                            let admin = currentFriend && currentFriend?.admins!.some(admin => admin === user._id);
                            return (
                                <UserCard key={index} value={user} contacts={true} isAdmin={admin} handleOnClick={() => onClickUser(user)} />
                            )
                        })
                    }
                </div>
                <div className='py-3 bg-[#111b21]'>
                    <div className='text-red-600 hover:bg-[#0c1317] px-7 py-2 sm:cursor-pointer font-Rubik font-[450] gap-5 flex items-center text-[1rem]'>
                        <MdDelete size={20} />
                        <h3>Delete Chat</h3>
                    </div>
                    <div className='text-red-600 hover:bg-[#0c1317] px-7 py-2 sm:cursor-pointer font-Rubik font-[450] gap-5 flex items-center text-[1rem]'>
                        <MdBlock size={20} />
                        <h3>Block {formattedTitle.split(' ')[0]}</h3>
                    </div>
                    <div className='text-red-600 hover:bg-[#0c1317] px-7 py-2 sm:cursor-pointer font-Rubik font-[450] gap-5 flex items-center text-[1rem]'>
                        <FaThumbsDown size={20} />
                        <h3>Report {formattedTitle.split(' ')[0]}</h3>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default React.memo(ContactInfo);