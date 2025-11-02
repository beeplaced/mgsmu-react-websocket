import { useEffect, useState } from "react";

type MessageData = string | object;

type WebSocketMessage = { // Type representing a single WebSocket message
  message: MessageData;
  updatedAt: number;
};

type WebSocketState = { // Type representing a single WebSocket connection state
  name: string;
  socket: WebSocket | null;
  connected: boolean;
  connecting: boolean;
  messages: WebSocketMessage[];
  storeHistory: boolean;
};

let state: Record<string, WebSocketState> = {};// Map of URL → WebSocketState

const listeners: Record<string, Set<() => void>> = {};

export const getWebSocketState = (name: string): WebSocketState => {
  return state[name] || { name: null, socket: null, connected: false, connecting: false, messages: [], storeHistory: false };
};

const getListeners = (name: string): Set<() => void> => {
  if (!listeners[name]) listeners[name] = new Set();
  return listeners[name];
};

const notifyListeners = (name: string) => {
  const subs = getListeners(name);
  subs.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error(`WebSocket listener for "${name}" threw an error:`, err);
    }
  });
};
const setWebSocketState = (name: string, partial: Partial<WebSocketState>) => {
  state[name] = { ...getWebSocketState(name), ...partial };
  notifyListeners(name);
};

const latestMessages: Record<string, WebSocketMessage> = {}; // Latest message per URL

const addMessage = (name: string, msg: WebSocketMessage) => {
  latestMessages[name] = msg;
  notifyListeners(name);
};

const subscribeWebSocket = (name: string, listener: () => void): (() => void) => {
  const ls = getListeners(name);
  ls.add(listener);
  return () => ls.delete(listener);
};

//Usable Hooks
export const useWebSocketStore = (name: string) => {
  const [wsValue, setWsValue] = useState<WebSocketState>(() => getWebSocketState(name));

  useEffect(() => {
    const update = () => setWsValue({ ...getWebSocketState(name) });
    const unsubscribe = subscribeWebSocket(name, update);
    return unsubscribe;
  }, [name]);

  return [latestMessages[name] || null, wsValue] as const;
};

export const useWebSocketConnect = ({ /** Hook to connect to a WebSocket */
  name,
  url,
  autoReconnect = false,
  reconnectDelay = 5000,
  storeHistory = false,
  maxMessages = 2,
  heartbeatInterval = 15000
}: {
  name: string;
  url: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  storeHistory?: boolean;
  maxMessages?: number;
  heartbeatInterval?: number;
}) => {

  const [lastMessageTime, setLastMessageTime] = useState<number | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: number | null;

    const connect = () => {
      const current = getWebSocketState(name);
      if (current.connected || current.connecting) return;

      setWebSocketState(name, { name, storeHistory, connecting: true });
      socket = new WebSocket(url);

      socket.onopen = () => {
        setWebSocketState(name, { socket, connected: true, connecting: false });
        //if (heartbeatInterval) setLastMessageTime(Date.now());
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
          addMessage(name, msg);
          if (heartbeatInterval) setLastMessageTime(Date.now());
          if (storeHistory) {
            const cur = getWebSocketState(name);
            const updatedMessages = [...cur.messages, msg];
            const limitedMessages = maxMessages !== undefined
              ? updatedMessages.slice(-maxMessages)
              : updatedMessages;
            setWebSocketState(name, { messages: limitedMessages });
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      socket.onclose = () => {
        setWebSocketState(name, { socket: null, connected: false, connecting: false });
        if (autoReconnect) {
          reconnectTimeout = setTimeout(connect, reconnectDelay);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket error", err);
        setWebSocketState(name, { connected: false, connecting: false });
        if (socket) socket.close();
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      setWebSocketState(name, { socket: null, connected: false, connecting: false });
    };
  }, [url, name, autoReconnect, reconnectDelay, storeHistory, maxMessages]);

  useEffect(() => {
    if (!heartbeatInterval || lastMessageTime === null) return;
    const timer = setTimeout(() => {
      addMessage(name, {
        message: { info: `end of transfer after ${heartbeatInterval}ms` },
        updatedAt: Date.now()
      });
    }, heartbeatInterval);
    return () => clearTimeout(timer);
  }, [lastMessageTime, heartbeatInterval]);

};

export const disconnectWebSocket = (name: string) => { /** Func to disconnect a WebSocket */
  const cur = getWebSocketState(name);
  if (cur.socket) cur.socket.close();
  setWebSocketState(name, { socket: null, connected: false, connecting: false });
};

export const sendWebSocketMessage = (name: string, msg: MessageData) => { /** Send a message on a specific WebSocket */
  const { socket, connected } = getWebSocketState(name);

  if (!connected || !socket) {
    console.warn("WebSocket is not connected. Cannot send message:", name);
    return;
  }

  try {
    const payload = typeof msg === "string" ? msg : JSON.stringify(msg);
    socket.send(payload);
  } catch (err) {
    console.error("Failed to send WebSocket message:", err);
  }
};

export const clearWebSocketMessage = (name: string) => {
  if (latestMessages[name]) {
    delete latestMessages[name];
    notifyListeners(name);
  }
};