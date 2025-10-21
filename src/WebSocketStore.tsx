import { useEffect, useState } from "react";

type MessageData = string | object;

type WebSocketMessage = { // Type representing a single WebSocket message
  message: MessageData;
  updatedAt: number;
};

type WebSocketState = { // Type representing a single WebSocket connection state
  socket: WebSocket | null;
  connected: boolean;
  connecting: boolean;
  messages: WebSocketMessage[];
  storeHistory: boolean;
};

let state: Record<string, WebSocketState> = {};// Map of URL → WebSocketState

const listeners: Record<string, Set<() => void>> = {};

export const getWebSocketState = (url: string): WebSocketState => {
  return state[url] || { socket: null, connected: false, connecting: false, messages: [], storeHistory: false };
};

const getListeners = (url: string): Set<() => void> => {
  if (!listeners[url]) listeners[url] = new Set();
  return listeners[url];
};

const notifyListeners = (url: string) => {
  const subs = getListeners(url);
  subs.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error(`WebSocket listener for "${url}" threw an error:`, err);
    }
  });
};
const setWebSocketState = (url: string, partial: Partial<WebSocketState>) => {
  state[url] = { ...getWebSocketState(url), ...partial };
  notifyListeners(url);
};

const latestMessages: Record<string, WebSocketMessage> = {}; // Latest message per URL

const addMessage = (url: string, msg: WebSocketMessage) => {
  latestMessages[url] = msg;
  notifyListeners(url);
};

const subscribeWebSocket = (url: string, listener: () => void): (() => void) => {
  const ls = getListeners(url);
  ls.add(listener);
  return () => ls.delete(listener);
};

//Usable Hooks
export const useWebSocketStore = (url: string) => {
  const [wsValue, setWsValue] = useState<WebSocketState>(() => getWebSocketState(url));

  useEffect(() => {
    const update = () => setWsValue({ ...getWebSocketState(url) });
    const unsubscribe = subscribeWebSocket(url, update);
    return unsubscribe;
  }, [url]);

  return [latestMessages[url] || null, wsValue] as const;
};

export const useWebSocketConnect = ({ /** Hook to connect to a WebSocket */
  url,
  autoReconnect = false,
  reconnectDelay = 5000,
  storeHistory = true,
  maxMessages = 2,
}: {
  url: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  storeHistory?: boolean;
  maxMessages?: number;
}) => {
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: number | null;

    const connect = () => {
      const current = getWebSocketState(url);
      if (current.connected || current.connecting) return;

      setWebSocketState(url, { storeHistory, connecting: true });
      socket = new WebSocket(url);

      socket.onopen = () => {
        setWebSocketState(url, { socket, connected: true, connecting: false });
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          let data: MessageData = event.data;
          if (typeof data === "string") {
            try {
              data = JSON.parse(data);
            } catch (parseError) {
              console.warn("no json message");
            }
          }
          const msg: WebSocketMessage = { message: data, updatedAt: Date.now() };
          addMessage(url, msg);
          if (storeHistory) {
            const cur = getWebSocketState(url);
            const updatedMessages = [...cur.messages, msg];
            const limitedMessages = maxMessages !== undefined
              ? updatedMessages.slice(-maxMessages)
              : updatedMessages;
            setWebSocketState(url, { messages: limitedMessages });
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      socket.onclose = () => {
        setWebSocketState(url, { socket: null, connected: false, connecting: false });
        if (autoReconnect) {
          reconnectTimeout = setTimeout(connect, reconnectDelay);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket error", err);
        setWebSocketState(url, { connected: false, connecting: false });
        if (socket) socket.close();
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      setWebSocketState(url, { socket: null, connected: false, connecting: false });
    };
  }, [url, autoReconnect, reconnectDelay, storeHistory, maxMessages]);
};

export const disconnectWebSocket = (url: string) => { /** Func to disconnect a WebSocket */
  const cur = getWebSocketState(url);
  if (cur.socket) cur.socket.close();
  setWebSocketState(url, { socket: null, connected: false, connecting: false });
};

export const sendWebSocketMessage = (url: string, msg: MessageData) => { /** Send a message on a specific WebSocket */
  const { socket, connected } = getWebSocketState(url);

  if (!connected || !socket) {
    console.warn("WebSocket is not connected. Cannot send message:", url);
    return;
  }

  try {
    const payload = typeof msg === "string" ? msg : JSON.stringify(msg);
    socket.send(payload);
  } catch (err) {
    console.error("Failed to send WebSocket message:", err);
  }
};