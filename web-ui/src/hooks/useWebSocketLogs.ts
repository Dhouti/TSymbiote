import { useState, useRef, useEffect, useCallback } from 'react';
import * as api from '../api';
import { WEBSOCKET_CONFIG } from '../constants';

const { PING_INTERVAL_MS: PING_INTERVAL, PONG_TIMEOUT_MS: PONG_TIMEOUT } = WEBSOCKET_CONFIG;

// Stream types supported by the generic websocket hook
export type StreamType = 'Logs' | 'BusEvents';

interface UseWebSocketStreamReturn {
  streamData: Record<string, string>;
  setStreamData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isStreaming: boolean;
  activeStreamType: StreamType | null;
  startStream: (streamType: StreamType, hostIds: string[]) => void;
  cancelStreaming: (appendDisconnectMessage?: boolean) => void;
}

// Message formatter type for different stream types
type MessageFormatter = (decodedMessage: string) => string | null;

// Format log messages with timestamp
const formatLogMessage: MessageFormatter = (decodedMessage: string) => {
  try {
    const logEntry = JSON.parse(decodedMessage);
    const text = logEntry.text || '';

    if (logEntry.logtail && logEntry.logtail.client_time) {
      const timestamp = new Date(logEntry.logtail.client_time);
      const timeStr = timestamp.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });
      return `[${timeStr}] ${text}`;
    }
    return text;
  } catch {
    return null;
  }
};

// Format bus event messages
const formatBusEventMessage: MessageFormatter = (decodedMessage: string) => {
  try {
    const event = JSON.parse(decodedMessage);

    // Format: [Count] Type: From -> To
    // Example: [6] magicsock.UDPRelayAllocReq: magicsock.Conn -> [relayserver.extension]
    const count = event.Count !== undefined ? `[${event.Count}] ` : '';
    const type = event.Type || 'unknown';
    const from = event.From || '';
    const to = Array.isArray(event.To) ? event.To.join(', ') : (event.To || '');

    let line = `${count}${type}`;
    if (from || to) {
      line += `: ${from}`;
      if (to) {
        line += ` -> [${to}]`;
      }
    }

    return line + '\n';
  } catch {
    // If parsing fails, return the raw message
    return decodedMessage + '\n';
  }
};

// Get the appropriate formatter for the stream type
const getMessageFormatter = (streamType: StreamType): MessageFormatter => {
  switch (streamType) {
    case 'Logs':
      return formatLogMessage;
    case 'BusEvents':
      return formatBusEventMessage;
    default:
      return formatLogMessage;
  }
};

// Get disconnect message for stream type
const getDisconnectMessage = (streamType: StreamType): string => {
  switch (streamType) {
    case 'Logs':
      return '\n[logtap disconnected]';
    case 'BusEvents':
      return '\n[bus events disconnected]';
    default:
      return '\n[disconnected]';
  }
};

// Get connecting message for stream type
const getConnectingMessage = (streamType: StreamType): string => {
  switch (streamType) {
    case 'Logs':
      return 'Connecting to log stream...\n';
    case 'BusEvents':
      return 'Connecting to bus events stream...\n';
    default:
      return 'Connecting to stream...\n';
  }
};

export function useWebSocketStream(): UseWebSocketStreamReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const hostIdsRef = useRef<string[]>([]);
  const lastPongTime = useRef<number>(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamTypeRef = useRef<StreamType | null>(null);

  const [streamData, setStreamData] = useState<Record<string, string>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreamType, setActiveStreamType] = useState<StreamType | null>(null);

  const cancelStreaming = useCallback((appendDisconnectMessage = true) => {
    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    lastPongTime.current = 0;

    // Append disconnect message if requested
    if (appendDisconnectMessage && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && streamTypeRef.current) {
      const disconnectMsg = getDisconnectMessage(streamTypeRef.current);
      hostIdsRef.current.forEach(hostId => {
        setStreamData(prev => ({ ...prev, [hostId]: (prev[hostId] || '') + disconnectMsg }));
      });
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Closing WebSocket connection for hosts:', hostIdsRef.current.join(','));
      wsRef.current.close(1000, 'Client closing');
    }
    wsRef.current = null;
    hostIdsRef.current = [];
    streamTypeRef.current = null;
    setIsStreaming(false);
    setActiveStreamType(null);
  }, []);

  const startStream = useCallback((streamType: StreamType, hostIds: string[]) => {
    // Cancel any existing stream
    cancelStreaming(false);

    if (hostIds.length === 0) {
      return;
    }

    setStreamData({});
    setIsStreaming(true);
    setActiveStreamType(streamType);
    hostIdsRef.current = hostIds;
    streamTypeRef.current = streamType;

    // Initialize stream data for all hosts
    const initialData: Record<string, string> = {};
    const connectingMessage = getConnectingMessage(streamType);
    hostIds.forEach(hostId => {
      initialData[hostId] = connectingMessage;
    });
    setStreamData(initialData);

    try {
      console.log(`Starting WebSocket ${streamType} stream for hosts:`, hostIds.join(','));

      const wsUrl = api.getStreamWebSocketUrl(streamType, hostIds);
      console.log('Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      const messageFormatter = getMessageFormatter(streamType);
      const disconnectMsg = getDisconnectMessage(streamType);

      ws.onopen = () => {
        console.log(`WebSocket connected for ${streamType}, hosts:`, hostIds.join(','));
        const clearedData: Record<string, string> = {};
        hostIds.forEach(hostId => {
          clearedData[hostId] = '';
        });
        setStreamData(clearedData);
      };

      ws.onmessage = (event) => {
        // Handle pong response for keepalive
        if (event.data === 'pong') {
          lastPongTime.current = Date.now();
          return;
        }

        try {
          // Parse the outer message containing host and base64-encoded message
          const wsMessage = JSON.parse(event.data);
          const hostId = wsMessage.Host;
          const encodedMessage = wsMessage.Message;

          console.log(`Received WebSocket ${streamType} message for host:`, hostId, 'length:', event.data.length);

          // Decode the base64-encoded message
          const decodedMessage = atob(encodedMessage);

          // Handle "websocket closed" message for a specific host
          if (decodedMessage === 'websocket closed') {
            setStreamData(prev => ({ ...prev, [hostId]: (prev[hostId] || '') + disconnectMsg }));
            return;
          }

          // Format the message using the stream-specific formatter
          const formattedMessage = messageFormatter(decodedMessage);
          if (formattedMessage !== null) {
            setStreamData(prev => ({ ...prev, [hostId]: (prev[hostId] || '') + formattedMessage }));
          }
        } catch (e) {
          // If parsing fails, log error for debugging
          console.error(`Error parsing WebSocket ${streamType} message:`, e, 'raw data:', event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Don't display error - timeout handler will show [connection timeout] if needed
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        // Clean up if not already handled by timeout
        if (wsRef.current) {
          lastPongTime.current = 0;
          wsRef.current = null;
          hostIdsRef.current = [];
          streamTypeRef.current = null;
          setIsStreaming(false);
          setActiveStreamType(null);
        }
      };

    } catch (err) {
      console.error(`Error setting up WebSocket for ${streamType}:`, err);
      // Don't display error in stream pane
    }

    // Start ping interval to detect stale connections
    pingIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const ws = wsRef.current;

      if (!ws) return;

      // Check if we haven't received a pong in too long
      if (lastPongTime.current > 0 && now - lastPongTime.current > PONG_TIMEOUT) {
        console.log('Connection timeout');
        hostIdsRef.current.forEach(hostId => {
          setStreamData(prev => ({ ...prev, [hostId]: (prev[hostId] || '') + '\n[connection timeout]' }));
        });
        wsRef.current = null;
        lastPongTime.current = 0;
        hostIdsRef.current = [];
        streamTypeRef.current = null;
        ws.close(1000, 'Connection timeout');
        setIsStreaming(false);
        setActiveStreamType(null);
        return;
      }

      // Send ping if connection is open
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
        // Initialize lastPongTime on first ping if not set
        if (lastPongTime.current === 0) {
          lastPongTime.current = now;
        }
      }
    }, PING_INTERVAL);
  }, [cancelStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        console.log('Component unmounting, closing WebSocket for hosts:', hostIdsRef.current.join(','));
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
      hostIdsRef.current = [];
      streamTypeRef.current = null;
      lastPongTime.current = 0;
    };
  }, []);

  return {
    streamData,
    setStreamData,
    isStreaming,
    activeStreamType,
    startStream,
    cancelStreaming,
  };
}

// Legacy hook for backwards compatibility - wraps the generic hook
interface UseWebSocketLogsReturn {
  logsData: Record<string, string>;
  setLogsData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isStreaming: boolean;
  startLogStream: (hostIds: string[]) => void;
  cancelStreaming: (appendDisconnectMessage?: boolean) => void;
}

export function useWebSocketLogs(): UseWebSocketLogsReturn {
  const {
    streamData,
    setStreamData,
    isStreaming,
    startStream,
    cancelStreaming,
  } = useWebSocketStream();

  const startLogStream = useCallback((hostIds: string[]) => {
    startStream('Logs', hostIds);
  }, [startStream]);

  return {
    logsData: streamData,
    setLogsData: setStreamData,
    isStreaming,
    startLogStream,
    cancelStreaming,
  };
}
