import React, { useEffect, useRef } from 'react';
import ChatHeader from './ChatHeader';
import MessageBar from './MessageBar';
import ChatPage from './ChatPage';

import { useSelector } from 'react-redux';
import { RootState } from '../../Redux/store';
import ContactInfo from '../../pages/ContactInfo';
import MsgRecoder from './MsgRecoder';

import { useLocation } from 'react-router-dom';

const Chat = ({
  handleSendOffer,
  handleOffer,
  rejectCall
}: {
  handleSendOffer: () => void;
  handleOffer: () => void;
  rejectCall: () => void;
}) => {

  const location = useLocation();

  const selectedChat = location.state?.chat;

  const chatPageRef = useRef<HTMLDivElement | null>(null);

  const { friends, currentUserIndex } = useSelector(
    (state: RootState) => state.msg
  );

  const { isRecord } = useSelector(
    (state: RootState) => state.features
  );

  // User yang sedang aktif
  const currentUser = friends[currentUserIndex];

  // =========================================================
  // AUTO SCROLL
  // =========================================================
  useEffect(() => {
    const container = chatPageRef.current;

    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [currentUserIndex, friends]);

  // =========================================================
  // SCROLL TO MESSAGE
  // =========================================================
  const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(
      `message-${messageId}`
    );

    const container = chatPageRef.current;

    if (!messageElement || !container) return;

    const chatWindowHeight = container.clientHeight;
    const messageHeight = messageElement.clientHeight;
    const messageTop = messageElement.offsetTop;

    const scrollToPosition =
      messageTop -
      (chatWindowHeight - messageHeight) / 2;

    container.scrollTo({
      top: scrollToPosition,
      behavior: 'smooth',
    });

    messageElement.style.backgroundColor =
      'rgba(135, 206, 250, 0.2)';

    setTimeout(() => {
      messageElement.style.transition =
        'background-color 0.5s ease, opacity 0.5s ease';

      messageElement.style.backgroundColor = '';
    }, 1000);
  };

  return (
    <div
      className="
        h-screen
        min-h-0
        w-full
        flex
        flex-col
        backImg
        bg-black
        overflow-hidden
      "
    >

      {/* =====================================================
          CHAT HEADER
      ===================================================== */}
      <div className="flex-none w-full">
        <ChatHeader
          handleSendOffer={handleSendOffer}
          chat={selectedChat}
        />
      </div>

      {/* =====================================================
          CHAT AREA
      ===================================================== */}
      <div
        ref={chatPageRef}
        className="
          flex-1
          min-h-0
          w-full
          overflow-y-auto
          overflow-x-hidden
          custom-scrollbar
          bg-black
          bg-opacity-80
          scroll-smooth
        "
      >
        <ChatPage
          rejectCall={rejectCall}
          handleOffer={handleOffer}
          scrollToMessage={scrollToMessage}
        />
      </div>

      {/* =====================================================
          MESSAGE BAR
      ===================================================== */}
      <div className="flex-none w-full bg-[#202c33]">
        {isRecord === false ? (
          <MessageBar />
        ) : (
          <MsgRecoder />
        )}
      </div>

      {/* =====================================================
          CONTACT INFO
      ===================================================== */}
      <ContactInfo />

    </div>
  );
};

export default React.memo(Chat);