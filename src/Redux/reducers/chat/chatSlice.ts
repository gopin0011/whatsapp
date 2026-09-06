import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ChatState {
  // Key adalah JID (misal: "123@g.us"), value adalah array pesan
  byJid: Record<string, any[]>;
}

const initialState: ChatState = {
  byJid: {},
};

export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    // Simpan seluruh riwayat chat untuk 1 JID
    setChatHistory: (
      state,
      action: PayloadAction<{ jid: string; messages: any[] }>
    ) => {
      const { jid, messages } = action.payload;
      state.byJid[jid.toLowerCase()] = messages;
    },

    // Tambahkan 1 pesan baru dari WebSocket
    appendMessage: (
      state,
      action: PayloadAction<{ jid: string; message: any }>
    ) => {
      const { jid, message } = action.payload;
      const key = jid.toLowerCase();

      if (!state.byJid[key]) {
        state.byJid[key] = [];
      }

      // Cegah duplikasi pesan
      const exists = state.byJid[key].some((m) => m._id === message._id);
      if (!exists) {
        state.byJid[key].push(message);
      }
    },
  },
});

export const { setChatHistory, appendMessage } = chatSlice.actions;
export default chatSlice.reducer;