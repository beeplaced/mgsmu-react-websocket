import { useEffect, useState } from "react";

type MessageData = string | any[];

export type WebSocketMessage = { // Type representing a single WebSocket message
  message: MessageData;
  updatedAt: number;
};

export type WebSocketState = { // Type representing a single WebSocket connection state
  socket: WebSocket | null;
  connected: boolean;
  connecting: boolean;
  messages: WebSocketMessage[];
  storeHistory: boolean;
};

let state: Record<string, WebSocketState> = {};// Map of URL → WebSocketState

const listeners = new Set<() => void>();

export const getWebSocketState = (url: string): WebSocketState => {
  return state[url] || { socket: null, connected: false, connecting: false, messages: [], storeHistory: false };
};

export const setWebSocketState = (url: string, partial: Partial<WebSocketState>) => { // Update state for a specific URL and notify listeners
  state[url] = { ...getWebSocketState(url), ...partial };
  listeners.forEach((l) => l());
};

const latestMessages: Record<string, WebSocketMessage> = {}; // Latest message per URL

export const addMessage = (url: string, msg: WebSocketMessage) => { // Add a message to a connection
  latestMessages[url] = msg;
  listeners.forEach((l) => l());
};

export const subscribeWebSocket = (listener: () => void): (() => void) => { // Subscribe a listener to any state change
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useWebSocketStore = (url: string) => { /** Hook to use the WebSocket store reactively in components */
  const [wsValue, setWsValue] = useState<WebSocketState>(() => getWebSocketState(url));

  useEffect(() => {
    const update = () => setWsValue({ ...getWebSocketState(url) });
    const unsubscribe = subscribeWebSocket(update);
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
            } catch (parseError) { console.warn("no json message");
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

    return () => { // Cleanup function
      if (socket) {
        socket.close();
        socket = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
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