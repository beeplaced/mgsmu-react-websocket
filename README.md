# mgsmu-react-websocket

mgsmu-react-websocket is a React library that provides global state management for WebSocket connections and now also supports Server-Sent Events (SSE). It allows you to connect to a WebSocket or SSE URL once and access its messages in any component without reconnecting multiple times.

---

## Features

- **Multiple connection support** — manage several WebSocket or SSE connections simultaneously. Identify connections by names.
- **Reactive hooks** — access the latest message and connection state inside any React component.
- **Automatic reconnect** — safely reconnect if a connection drops.
- **Message history** — optionally store a configurable number of past messages.
- **Easy-to-use utilities** — send messages or disconnect connections from anywhere in your app.
- **Dual transport support** — seamlessly use WebSocket or Server-Sent Events (SSE) without changing your component logic.

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
//App.tsx -> connect 
import { useWebSocketConnect } from "./WebSocketStore";

const App: React.FC = () => {
  const Connection1 = "wss://ws.ifelse.io";
  const Connection2 = "wss://echo.websocket.org";
  const Connection3 = "http://localhost:4000/sse"; // Optional SSE connection
  const name1 = 'else';
  const name2 = 'echo';
  const name3 = "sseExample";

  useWebSocketConnect({ name: 'else', url: Connection1, maxMessages: 10, autoReconnect: true });
  useWebSocketConnect({ name: 'echo', url: Connection2 });
  useWebSocketConnect({ name: name3, url: Connection3, type: "sse", storeHistory: true }); // Optional SSE connection


  return (
    <Router>
      <Routes>
        <Route path="*" element={<Example />} />
      </Routes>
    </Router>
  );
};
```

```jsx

import { useEffect } from "react";
import { useWebSocketStore, disconnectWebSocket, sendWebSocketMessage, clearWebSocketMessage } from "mgsmu-react-websocket";

const Example = () => { //example Route

  const name1 = 'else';
  const name2 = 'echo';

  // Access latest message and connection state with types
  const [msg1, ws1] = useWebSocketStore(name1);
  const [msg2, ws2] = useWebSocketStore(name2);

  useEffect(() => { // Log connection state whenever it changes
    console.log("Connection2 state:", ws2);
  }, [ws2]);

  useEffect(() => { //Remeber to clear message after usage 
  if (message) {
    console.log("New message:", message);
    // ...process message...
    clearWebSocketMessage("else");
  }
}, [msg1]);

  return (
    <div>
      <div>
        <h3>Connection 1 Status: {ws1.connected ? "Connected" : "Disconnected"}</h3>
        <div>Latest Message: {JSON.stringify(msg1?.message)}</div>
        <button onClick={() => sendWebSocketMessage(name1, "Hello from else")}>
          Send String to else
        </button>
        <button onClick={() => disconnectWebSocket(name1)}>Disconnect 1</button>
      </div>
      <div>
        <h3>Connection 2 Status: {ws2.connected ? "Connected" : "Disconnected"}</h3>
        <div>Latest Message: {JSON.stringify(msg2?.message)}</div>
        <button onClick={() => sendWebSocketMessage(name1, { data: true })}>
          Send Object to echo
        </button>
        <button onClick={() => disconnectWebSocket(name1)}>Disconnect 2</button>
      </div>
    </div>
  );
};

export default Example;

```

# API Hooks

## useWebSocketStore(name: string)
- Returns a tuple: [latestMessage, connectionState] for a given name.
```ts
const [latestMessage, connectionState] = useWebSocketStore(name);
```
- latestMessage: WebSocketMessage | null — the most recent message received.
- connectionState: WebSocketState — the current state of the WebSocket connection:

```ts
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
```
## useWebSocketConnect(options)
- Connects to a WebSocket or SSE endpoint and manages automatic reconnects, message history, and connection state updates.

```ts
const options = {
  name: string;                  // Unique name for this connection
  url: string;                   // WebSocket (ws:// or wss://) or SSE (http:// or https://) URL
  type?: "ws" | "sse";           // Transport type, default: "ws"
  autoReconnect?: boolean;       // Auto reconnect for WebSocket if connection drops, default: true
  reconnectDelay?: number;       // Reconnect delay in ms, default: 5000
  storeHistory?: boolean;        // Store message history, default: true
  maxMessages?: number;          // Max number of stored messages, default: 2
  heartbeatInterval?: number;    // Interval for heartbeat / end-of-transfer message in ms, default: 5000
}
```

----
**Notes**
- Supports multiple WebSocket or SSE connections simultaneously.
- Automatically handles cleanup and memory management on component unmount.
- Message history is configurable via storeHistory and maxMessages.

----
# Changelog

All notable changes to this project will be documented in this file.
---
[1.1.7] - 2025-12-07
- unified connection message, JSON.parse for SSE
- State: connection: WebSocket | EventSource | null
[1.1.6] - 2025-12-06
- Added SSE support — useWebSocketConnect can now connect to Server-Sent Events (SSE) endpoints with type: "sse".
- SSE connections are receive-only; messages are stored in global state and accessible via useWebSocketStore.
- Updated sendWebSocketMessage to gracefully handle SSE connections (logs a warning instead of sending).
- Unified heartbeat/end-of-transfer handling for both WebSocket and SSE connections.
- Fixed TypeScript issue with setTimeout type on reconnectTimeout (ReturnType<typeof setTimeout>).
- Preserved existing WebSocket API and hooks for backward compatibility.

## [1.1.5] - 2025-11-02
- ping only start after first message
## [1.1.4] - 2025-11-01
- raise default heartbeatInterval to 15, and no set on connect
## [1.1.3] - 2025-11-01
- added heartbeatInterval to send rebounce ping after transfer ends
## [1.1.2] - 2025-11-01
- added clearWebSocketMessage