# mgsmu-react-websocket

mgsmu-react-websocket is a library for React that provides global state management for WebSocket connections. It allows you to connect to a WebSocket once and use its messages in any component without reconnecting.

---

## Features

- **Multiple connection support** — manage several WebSocket connections simultaneously.
- **Reactive hooks** — access the latest message and connection state inside any React component.
- **Automatic reconnect** — safely reconnect if a connection drops.
- **Message history** — optionally store a configurable number of past messages.
- **Easy-to-use utilities** — send messages or disconnect connections from anywhere in your app.

In short: connect once, and all components can reactively use the messages and connection state, without opening multiple WebSocket connections.

---

## Installation

```bash
npm install mgsmu-react-websocket
# or
yarn add mgsmu-react-websocket
```

## Usage Example

```jsx
import { useEffect } from "react";
import { useWebSocketStore, useWebSocketConnect, disconnectWebSocket, sendWebSocketMessage,
  WebSocketMessage, WebSocketState //types
} from "mgsmu-react-websocket";

const Example = () => {
  const Connection1 = "wss://ws.ifelse.io";
  const Connection2 = "wss://echo.websocket.org";

  // Access latest message and connection state with types
  const [msg1, ws1]: [WebSocketMessage | null, WebSocketState] = useWebSocketStore(Connection1);
  const [msg2, ws2]: [WebSocketMessage | null, WebSocketState] = useWebSocketStore(Connection2);

  // Connect to WebSocket servers
  useWebSocketConnect({ url: Connection1 });
  useWebSocketConnect({ url: Connection2 });

  useEffect(() => {
    // Log connection state whenever it changes
    console.log("Connection2 state:", ws2);
  }, [ws2]);

  return (
    <div>
      <div>
        <h3>Connection 1 Status: {ws1.connected ? "Connected" : "Disconnected"}</h3>
        <div>Latest Message: {JSON.stringify(msg1?.message)}</div>
        <button onClick={() => sendWebSocketMessage(Connection1, "Hello from Connection1")}>
          Send to Connection1
        </button>
        <button onClick={() => disconnectWebSocket(Connection1)}>Disconnect 1</button>
      </div>
      <div>
        <h3>Connection 2 Status: {ws2.connected ? "Connected" : "Disconnected"}</h3>
        <div>Latest Message: {JSON.stringify(msg2?.message)}</div>
        <button onClick={() => sendWebSocketMessage(Connection2, "Hello from Connection2")}>
          Send to Connection2
        </button>
        <button onClick={() => disconnectWebSocket(Connection2)}>Disconnect 2</button>
      </div>
    </div>
  );
};

export default Example;

```

# API Hooks

## useWebSocketStore(url: string)
- Returns a tuple: [latestMessage, connectionState] for a given URL.
```ts
const [latestMessage, connectionState] = useWebSocketStore(url);
```
- latestMessage: WebSocketMessage | null — the most recent message received.
- connectionState: WebSocketState — the current state of the WebSocket connection:

```ts
type MessageData = string | any[];

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
```
## useWebSocketConnect(options)
- Connects to a WebSocket and manages automatic reconnects, history, and state updates.

```ts
const options = {
  url: string;
  autoReconnect?: boolean;      // default: true
  reconnectDelay?: number;      // ms, default: 5000
  storeHistory?: boolean;       // default: true
  maxMessages?: number;         // max number of messages to store
}
```

----
**Notes**
- Supports multiple WebSocket connections simultaneously.
- Automatically handles cleanup and memory management on component unmount.
- Message history is configurable via storeHistory and maxMessages.