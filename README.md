# mgsmu-react-websocket

mgsmu-react-websocket is a library for React that provides global state management for WebSocket connections. It allows you to connect to a WebSocket url once and use its messages in any component without reconnecting.

---

## Features

- **Multiple connection support** — manage several WebSocket connections simultaneously. Identify connections by names
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
//App.tsx -> connect 
import { useWebSocketConnect } from "./WebSocketStore";

const App: React.FC = () => {
  const Connection1 = "wss://ws.ifelse.io";
  const Connection2 = "wss://echo.websocket.org";
  const name1 = 'else';
  const name2 = 'echo';

  useWebSocketConnect({ name: 'else', url: Connection1, maxMessages: 10, autoReconnect: true });
  useWebSocketConnect({ name: 'echo', url: Connection2 });

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
- Connects to a WebSocket and manages automatic reconnects, history, and state updates.

```ts
const options = {
  name: string;
  url: string;
  autoReconnect?: boolean;      // default: true
  reconnectDelay?: number;      // ms, default: 5000
  storeHistory?: boolean;       // default: true
  maxMessages?: number;         // max number of messages to store, default 2
}
```

----
**Notes**
- Supports multiple WebSocket connections simultaneously.
- Automatically handles cleanup and memory management on component unmount.
- Message history is configurable via storeHistory and maxMessages.

----
# Changelog

All notable changes to this project will be documented in this file.
---
## [1.1.5] - 2025-11-02
- ping only start after first message
## [1.1.4] - 2025-11-01
- raise default heartbeatInterval to 15, and no set on connect
## [1.1.3] - 2025-11-01
- added heartbeatInterval to send rebounce ping after transfer ends
## [1.1.2] - 2025-11-01
- added clearWebSocketMessage