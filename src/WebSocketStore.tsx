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

export const useWebSocketConnect = ({
  name,
  url,
  autoReconnect = false,
  reconnectDelay = 5000,
  storeHistory = false,
  maxMessages = 2,
  heartbeatInterval = 5000,
  type = "ws" // new optional parameter: "ws" or "sse"
}: {
  name: string;
  url: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  storeHistory?: boolean;
  maxMessages?: number;
  heartbeatInterval?: number;
  type?: "ws" | "sse";
}) => {
  const [lastMessageTime, setLastMessageTime] = useState(Date.now());

  useEffect(() => {
    let socket: WebSocket | null = null;
    let evtSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const current = getWebSocketState(name);
      if (current.connected || current.connecting) return;

      setWebSocketState(name, { name, storeHistory, connecting: true });

      if (type === "ws") {
        // Original WebSocket connection
        socket = new WebSocket(url);

        socket.onopen = () => setWebSocketState(name, { socket, connected: true, connecting: false });

        socket.onmessage = (event: MessageEvent) => {
          handleMessage(event.data);
          if (heartbeatInterval) setLastMessageTime(Date.now());
        };

        socket.onclose = () => {
          setWebSocketState(name, { socket: null, connected: false, connecting: false });
          if (autoReconnect) reconnectTimeout = setTimeout(connect, reconnectDelay);
        };

        socket.onerror = (err) => {
          console.error("WebSocket error", err);
          setWebSocketState(name, { connected: false, connecting: false });
          if (socket) socket.close();
        };
      } else if (type === "sse") {
        // SSE connection
        evtSource = new EventSource(url);
        setWebSocketState(name, { socket: null, connected: true, connecting: false });

        evtSource.onmessage = (event) => {
          handleMessage(event.data);
          if (heartbeatInterval) setLastMessageTime(Date.now());
        };

        evtSource.onerror = (err) => {
          console.error("SSE error:", err);
          // optionally set connected false
          // autoReconnect is handled automatically by EventSource
        };
      }
    };

    const handleMessage = (data: any) => {
      try {
        let parsed: MessageData = data;
        if (typeof data === "string") {
          try { parsed = JSON.parse(data); } catch {}
        }

        const msg: WebSocketMessage = { message: parsed, updatedAt: Date.now() };
        addMessage(name, msg);

        if (storeHistory) {
          const cur = getWebSocketState(name);
          const updatedMessages = [...cur.messages, msg];
          const limitedMessages = maxMessages ? updatedMessages.slice(-maxMessages) : updatedMessages;
          setWebSocketState(name, { messages: limitedMessages });
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (evtSource) evtSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      setWebSocketState(name, { socket: null, connected: false, connecting: false });
    };
  }, [url, name, autoReconnect, reconnectDelay, storeHistory, maxMessages, type, heartbeatInterval]);
 
  useEffect(() => { // Countdown / heartbeat effect
    const timer = setTimeout(() => {
      addMessage(name, { 
        message: { info: `end of transfer after ${heartbeatInterval}ms` }, 
        updatedAt: Date.now() 
      });
    }, heartbeatInterval);
    return () => clearTimeout(timer);
  }, [lastMessageTime]);
};

export const disconnectWebSocket = (name: string) => { /** Func to disconnect a WebSocket */
  const cur = getWebSocketState(name);
  if (cur.socket) cur.socket.close();
  setWebSocketState(name, { socket: null, connected: false, connecting: false });
};

export const sendWebSocketMessage = (name: string, msg: MessageData) => { /** Send a message on a specific WebSocket */
  const { socket, connected } = getWebSocketState(name);

  if (!connected) {
    console.warn(`Connection "${name}" is not connected. Cannot send message.`);
    return;
  }

  // If it's SSE (socket is null), sending is not supported
  if (!socket) {
    console.warn(`Connection "${name}" is SSE (receive-only). Cannot send message.`);
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