import { IoMdVideocam } from "react-icons/io";
import { BsSearch, BsThreeDotsVertical } from "react-icons/bs";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../Redux/store";
import { FaCircleChevronDown, FaCircleUser } from "react-icons/fa6";
import { useEffect, useState } from "react";
import {
  ChatUser,
  setCurrentGrpOrUser,
  toggleContactInfo,
} from "../../Redux/reducers/msg/MsgReducer";
import { AiOutlineArrowLeft } from "react-icons/ai";
import { maskPhoneNumber } from "../cards/ReUseFunc";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import useCloseDropDown from "../reuse/CloseDropDown";
import { toast } from "react-toastify";

interface ChatHeaderLocationState {
  jid?: string;
  display_name?: string;
  pushName?: string;
  profile?: string;
  avatar?: string;
  conn_type?: string;
  online_status?: boolean;
}

interface ChatHeaderProps {
  handleSendOffer: () => void;
  chat?: any;
  displayName?: string;
  avatar?: string;
}

const ChatHeader = ({
  handleSendOffer,
  chat,
  displayName: propDisplayName,
  avatar: propAvatar,
}: ChatHeaderProps) => {
  const [grpUsers, setGrpUsers] = useState("");

  const dispatch: AppDispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { currentUserIndex, friends } = useSelector(
    (state: RootState) => state.msg
  );

  const [dropdown, setDropdown] = useCloseDropDown(
    false,
    ".dropdown"
  );

  // =========================================================
  // DATA DARI HOME / LOCATION STATE
  // =========================================================

  const chatState =
    (location.state as ChatHeaderLocationState | null) || null;

  // =========================================================
  // USER AKTIF
  // =========================================================

  const currentUser =
    chat ||
    friends[currentUserIndex];

  // =========================================================
  // DISPLAY NAME
  // Prioritas:
  // 1. prop direct dari Chat.tsx
  // 2. location state dari Users.tsx
  // 3. Redux / chat object display_name / pushName
  // 4. nomor dari JID
  // =========================================================

  const rawDisplayName =
    propDisplayName ||
    chatState?.display_name ||
    chatState?.pushName ||
    currentUser?.display_name ||
    currentUser?.displayName ||
    currentUser?.pushName ||
    "";

  const displayName =
    String(rawDisplayName).trim() !== ""
      ? Number(rawDisplayName)
        ? maskPhoneNumber(String(rawDisplayName))
        : String(rawDisplayName)
      : chatState?.jid
        ? chatState.jid.split("@")[0]
        : "Unknown";

  // =========================================================
  // AVATAR
  // Prioritas:
  // 1. prop direct dari Chat.tsx
  // 2. location state dari Users.tsx
  // 3. Redux profile / avatar / avatarUrl
  // =========================================================

  const profileUrl =
    propAvatar ||
    chatState?.avatar ||
    chatState?.profile ||
    currentUser?.profile ||
    currentUser?.avatar ||
    currentUser?.avatarUrl ||
    currentUser?.profileUrl ||
    "";

  // =========================================================
  // ONLINE STATUS
  // =========================================================

  const isOnline =
    chatState?.online_status ??
    currentUser?.online_status ??
    false;

  // =========================================================
  // GROUP USERS
  // =========================================================

  useEffect(() => {
    if (currentUser?.conn_type === "group") {
      const users: ChatUser[] = currentUser?.users || [];

      const usersString = users
        .map((user: ChatUser) => {
          const name = user?.display_name;

          if (!name) return "";

          return Number(name)
            ? maskPhoneNumber(String(name))
            : String(name);
        })
        .filter(Boolean)
        .join(", ");

      setGrpUsers(usersString);
    } else {
      setGrpUsers("");
    }
  }, [currentUser]);

  // =========================================================
  // DROPDOWN
  // =========================================================

  const handleDropdownClick = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.stopPropagation();
    setDropdown(!dropdown);
  };

  // =========================================================
  // CLOSE CHAT
  // =========================================================

  const handleCloseChat = () => {
    setDropdown(false);

    // 1. Pindah halaman ke Home terlebih dahulu
    navigate("/");

    // 2. Reset state Redux setelah halaman berpindah
    setTimeout(() => {
      dispatch(setCurrentGrpOrUser(null));
    }, 0);
  };

  // =========================================================
  // CONTACT INFO
  // =========================================================

  const handleOopenProfile = () => {
    dispatch(toggleContactInfo(true));
  };

  const closeContact = () => {
    dispatch(toggleContactInfo(true));
  };

  // =========================================================
  // VIDEO CALL
  // =========================================================

  const handleStartCall = () => {
    const connType =
      chatState?.conn_type ||
      currentUser?.conn_type;

    if (connType === "group") {
      toast.info(
        "For group video call is not implemented",
        {
          position: "top-left",
        }
      );
      return;
    }

    if (isOnline) {
      handleSendOffer();
    } else {
      toast.info(
        "You cannot call offline user.",
        {
          position: "top-left",
        }
      );
    }
  };

  return (
    <div
      className="
        h-16
        min-h-16
        flex-none
        gap-2
        sm:gap-5
        py-3
        px-1
        flex
        justify-between
        items-center
        bg-[#202c33]
        overflow-hidden
      "
    >

      {/* =====================================================
          BACK BUTTON MOBILE
      ===================================================== */}

      <div
        onClick={handleCloseChat}
        className="
          md:hidden
          block
          w-5
          p-5
          cursor-pointer
          flex-none
        "
      >
        <AiOutlineArrowLeft className="text-white" />
      </div>

      {/* =====================================================
          AVATAR
      ===================================================== */}

      <div
        onClick={handleOopenProfile}
        className="
          flex
          flex-none
          sm:cursor-pointer
          items-center
          justify-center
          chatList
        "
      >
        {profileUrl ? (
          <div className="relative sm:p-1 sm:w-auto w-[50px]">
            <img
              src={profileUrl}
              alt={displayName}
              className="w-[40px] h-[40px] rounded-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />

            {/* FALLBACK AVATAR */}
            <div
              className="
                avatar-fallback
                hidden
                w-[40px]
                h-[40px]
                rounded-full
                items-center
                justify-center
                bg-slate-500
              "
            >
              <FaCircleUser
                size={40}
                className="text-slate-300"
              />
            </div>

            {isOnline ? (
              <span className="blink_me absolute bottom-1 right-0" />
            ) : null}
          </div>
        ) : (
          <div className="relative p-1">
            <FaCircleUser
              size={40}
              className="text-slate-400"
            />

            {isOnline ? (
              <span className="blink_me absolute bottom-1 right-0" />
            ) : null}
          </div>
        )}
      </div>

      {/* =====================================================
          DISPLAY NAME + STATUS
      ===================================================== */}

      <div
        className="
          mr-auto
          sm:cursor-pointer
          min-w-0
          overflow-hidden
        "
        onClick={handleOopenProfile}
      >
        <span
          className="
            username
            font-bold
            block
            truncate
            text-white
          "
        >
          {displayName}
        </span>

        <span
          className="
            time
            text-sm
            line-clamp-1
            max-w-[600px]
          "
        >
          
        </span>
      </div>

      {/* =====================================================
          ACTION BUTTONS
      ===================================================== */}

      <div className="flex gap-2 flex-none">

        {/* VIDEO CALL */}
        <button
          onClick={handleStartCall}
          className="icons"
          type="button"
        >
          <IoMdVideocam title="video call" />
        </button>

        {/* SEARCH */}
        <div className="icons sm:block hidden">
          <BsSearch title="search in chat" />
        </div>

        {/* MORE */}
        <div
          onClick={handleDropdownClick}
          className="
            icons
            m-0
            sm:block
            hidden
            cursor-pointer
          "
        >
          <BsThreeDotsVertical title="settings" />
        </div>
      </div>

      {/* =====================================================
          DROPDOWN
      ===================================================== */}

      <div
        className={`${
          dropdown
            ? `
              scale-y-100
              opacity-100
              duration-300
              shadow-lg
              rounded-sm
              delay-75
              translate-x-0
              no-scrollbar
            `
            : `
              scale-y-0
              translate-x-0
              duration-100
              w-0
              opacity-0
            `
        }
        transition-all
        ease-in-out
        origin-top-right
        dropdown
        z-10
        top-16
        right-10
        `}
      >
        <div>

          <button
            onClick={closeContact}
            className="options"
            role="menuitem"
            id="menu-item-0"
          >
            Contact info
          </button>

          <button
            className="options"
            role="menuitem"
            id="menu-item-1"
          >
            <span>Theme</span>
            <FaCircleChevronDown className="inline font-Rubik" />
          </button>

          <Link
            to="#"
            className="options"
          >
            Clear Chat
          </Link>

          <button
            onClick={handleCloseChat}
            className="options"
            role="menuitem"
            id="menu-item-2"
          >
            Close Chat
          </button>

        </div>
      </div>
    </div>
  );
};

export default ChatHeader;