import "./css/App.css"
import 'react-toastify/dist/ReactToastify.css'
import { ToastContainer } from "react-toastify"
import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import { createContext } from "react"
import { Centrifuge } from "centrifuge"

// Tetap di-export supaya tidak error di komponen lain
export const SocketContext = createContext<Centrifuge | null>(null)
export const CallsContext = createContext<Centrifuge | null>(null)

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

      <SocketContext.Provider value={null}>
        <CallsContext.Provider value={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </CallsContext.Provider>
      </SocketContext.Provider>
    </>
  )
}

export default App