import React, { useEffect, useState } from 'react'
import Users from '../components/utilities/Users'
import axios from 'axios'
import { toast } from 'react-toastify'

const Home = () => {
  const [latestChats, setLatestChats] = useState([])
  const [isFetchingChats, setIsFetchingChats] = useState(false)

  useEffect(() => {
    const fetchLatestChats = async () => {
      try {
        setIsFetchingChats(true)
        const baseUrl = import.meta.env.VITE_API_CLIENT_URL || 'http://localhost:8081';
        const response = await axios.get(`${baseUrl}/getChat/wa-ninih`);
        if (response.data?.success) {
          setLatestChats(response.data.data)
        }
      } catch (error) {
        console.error('Gagal mengambil data chat:', error)
        toast.error('Gagal memuat pesan')
      } finally {
        setIsFetchingChats(false)
      }
    }

    fetchLatestChats()
  }, [])

  return (
    <main className="overflow-hidden relative h-screen">
      <Users latestChats={latestChats} isFetching={isFetchingChats} />
    </main>
  )
}

export default React.memo(Home)