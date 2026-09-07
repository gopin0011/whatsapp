import "./css/App.css";
import React, { useState } from 'react';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from "react-toastify";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Chat from './components/utilities/Chat';
import { SocketProvider } from "./context/SocketContext";

const App = () => {
  const [selectedInstance, setSelectedInstance] = useState('wa-ninih');

  return (
    <>
      <ToastContainer 
        position="top-right" 
        autoClose={5000} 
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false}
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme="light" 
      />

      <SocketProvider instance={selectedInstance}>
        <Routes>
          <Route path="/" element={<Home instance={selectedInstance} />} />
          <Route
            path="/chat/:jid"
            element={
              <Chat
                instance={selectedInstance} // Kirim juga ke Chat jika perlu
                handleSendOffer={() => {}}
                handleOffer={() => {}}
                rejectCall={() => {}}
              />
            }
          />
        </Routes>
      </SocketProvider>
    </>
  );
};

export default App;