import "./css/App.css";
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from "react-toastify";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Chat from './components/utilities/Chat';
import { SocketProvider } from "./context/SocketContext";

const App = () => {
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

      <SocketProvider>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route
            path="/chat/:jid"
            element={
              <Chat
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