import { io, type Socket } from "socket.io-client";

// Same-origin as the API in dev (Vite proxies /api, but sockets connect
// directly to the backend host/port since Vite's proxy doesn't cover
// websocket upgrade by default here).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
