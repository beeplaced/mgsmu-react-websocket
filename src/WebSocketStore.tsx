import { useEffect, useState } from "react";

type MessageData = string | object;

type WebSocketMessage = {
  message: MessageData;
  updatedAt: number;
};

type WebSocketState = {
  name: string;
  connection: WebSocket | EventSource | null;
  connected: boolean;
  connecting: boolean;
  messages: WebSocketMessage[];
  storeHistory: boolean;
};

let state: Record<string, WebSocketState> = {};

const listeners: Record<string, Set<() => void>> = {};

export const getWebSocketState = (name: string): WebSocketState => {

  return (
    state[name] || {
      name: null,
      connection: null,
      connected: false,
      connecting: false,
      messages: [],
      storeHistory: false,
    }
  );
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

const latestMessages: Record<string, WebSocketMessage> = {};

const addMessage = (name: string, msg: WebSocketMessage) => {
  latestMessages[name] = msg;
  notifyListeners(name);
};

const subscribeWebSocket = (name: string, listener: () => void): (() => void) => {
  const ls = getListeners(name);
  ls.add(listener);
  return () => ls.delete(listener);
};

// =========================
//       HOOKS
// =========================

export const useWebSocketStore = (name: string) => {
  const [wsValue, setWsValue] = useState<WebSocketState>(() =>
    getWebSocketState(name)
  );

  useEffect(() => {
    const update = () => setWsValue({ ...getWebSocketState(name) });
    const unsubscribe = subscribeWebSocket(name, update);
    return unsubscribe;
  }, [name]);

  return [latestMessages[name] || null, wsValue] as const;
};

// =========================
//    CONNECTION & USAGE
// =========================

export const useWebSocketConnect = ({
  name,
  url,
  autoReconnect = false,
  reconnectDelay = 5000,
  storeHistory = false,
  maxMessages = 2,
  heartbeatInterval = 5000,
  type = "ws",
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
    let connection: WebSocket | EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleMessage = (data: any) => {
      try {
        let parsed: MessageData = data;
        if (typeof data === "string") {
          try {
            parsed = JSON.parse(data);
          } catch { }
        }

        const msg: WebSocketMessage = {
          message: parsed,
          updatedAt: Date.now(),
        };

        addMessage(name, msg);

        if (storeHistory) {
          const cur = getWebSocketState(name);
          const updatedMessages = [...cur.messages, msg];
          const limitedMessages = maxMessages
            ? updatedMessages.slice(-maxMessages)
            : updatedMessages;

          setWebSocketState(name, { messages: limitedMessages });
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    };

    const connect = () => {
      const current = getWebSocketState(name);
      if (current.connected || current.connecting) return;

      setWebSocketState(name, {
        name,
        storeHistory,
        connecting: true,
      });

      if (type === "ws") {
        const ws = new WebSocket(url);
        connection = ws;

        ws.onopen = () => {
          setWebSocketState(name, {
            connection: ws,
            connected: true,
            connecting: false,
          });
        };

        ws.onmessage = (event) => {
          handleMessage(event.data);
          if (heartbeatInterval)
            setLastMessageTime(Date.now());
        };

        ws.onclose = () => {
          setWebSocketState(name, {
            connection: null,
            connected: false,
            connecting: false,
          });

          if (autoReconnect) reconnectTimeout = setTimeout(connect, reconnectDelay);
        };
      }

      if (type === "sse") {
          const es = new EventSource(url);

          es.onopen = () => {
            setWebSocketState(name, {
              connection: es,
              connected: true,
              connecting: false,
            });
          };

          es.onmessage = (event) => { // console.log("SSE message received:", event.data);
            try {
              const parsed = JSON.parse(event.data); // console.log("Parsed SSE message:", parsed);
              handleMessage(parsed);
            } catch (err) {
              console.warn("Failed to parse SSE message as JSON:", event.data, err);
              handleMessage(event.data);
            }
            setLastMessageTime(Date.now());
          };

          es.onerror = (err) => {
            if (es.readyState === EventSource.CLOSED) {
              setWebSocketState(name, {
                connection: null,
                connected: false,
                connecting: false,
              });

              if (autoReconnect) reconnectTimeout = setTimeout(connect, reconnectDelay);
            }
          };
      }
    };

    connect();

    return () => {
      if (connection instanceof WebSocket) connection.close();
      if (connection instanceof EventSource) connection.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      setWebSocketState(name, {
        connection: null,
        connected: false,
        connecting: false,
      });
    };
  }, [
    url,
    name,
    autoReconnect,
    reconnectDelay,
    storeHistory,
    maxMessages,
    type,
    heartbeatInterval,
  ]);

  useEffect(() => { // Heartbeat timeout message
    const timer = setTimeout(() => {
      addMessage(name, {
        message: { info: `end of transfer after ${heartbeatInterval}ms` },
        updatedAt: Date.now(),
      });
    }, heartbeatInterval);
    return () => clearTimeout(timer);
  }, [lastMessageTime]);
};

export const disconnectWebSocket = (name: string) => {
  const cur = getWebSocketState(name);

  cur.connection?.close?.();

  setWebSocketState(name, {
    connection: null,
    connected: false,
    connecting: false,
  });
};

export const sendWebSocketMessage = (name: string, msg: MessageData) => {
  const { connection, connected } = getWebSocketState(name);

  if (!connected) {
    console.warn(`Connection "${name}" is not connected.`);
    return;
  }

  if (!(connection instanceof WebSocket)) {
    console.warn(`Connection "${name}" is SSE (receive only).`);
    return;
  }

  try {
    connection.send(
      typeof msg === "string" ? msg : JSON.stringify(msg)
    );
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