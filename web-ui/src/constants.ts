/**
 * Application constants for TSymbiote
 */

// Panel configuration
export const PANEL_CONFIG = {
  MIN_HEIGHT: 180,
  MIN_VIEWPORT_MARGIN: 100,
  DEFAULT_EXPANDED_PERCENTAGE: 0.5,
} as const;

// WebSocket configuration
export const WEBSOCKET_CONFIG = {
  PING_INTERVAL_MS: 5000,
  PONG_TIMEOUT_MS: 10000,
} as const;

// Camera/graph controls
export const CAMERA_CONTROLS = {
  PAN_SPEED: 3,
} as const;

// Default layout
export const DEFAULT_LAYOUT = 'treeTd3d';

// Layout options for graph visualization
export const LAYOUT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'forceDirected2d', label: 'Force Directed 2D' },
  { value: 'forceDirected3d', label: 'Force Directed 3D' },
  { value: 'circular2d', label: 'Circular 2D' },
  { value: 'concentric2d', label: 'Concentric 2D' },
  { value: 'concentric3d', label: 'Concentric 3D' },
  { value: 'treeTd2d', label: 'Tree Top-Down 2D' },
  { value: 'treeTd3d', label: 'Tree Top-Down 3D' },
  { value: 'treeLr2d', label: 'Tree Left-Right 2D' },
  { value: 'treeLr3d', label: 'Tree Left-Right 3D' },
  { value: 'radialOut2d', label: 'Radial Out 2D' },
  { value: 'radialOut3d', label: 'Radial Out 3D' },
  { value: 'hierarchicalTd', label: 'Hierarchical Top-Down' },
  { value: 'hierarchicalLr', label: 'Hierarchical Left-Right' },
  { value: 'nooverlap', label: 'No Overlap' },
  { value: 'forceatlas2', label: 'Force Atlas 2' },
];

// DNS query types
export const DNS_QUERY_TYPES = [
  { value: 'A', label: 'A' },
  { value: 'AAAA', label: 'AAAA' },
  { value: 'CNAME', label: 'CNAME' },
  { value: 'MX', label: 'MX' },
  { value: 'TXT', label: 'TXT' },
  { value: 'NS', label: 'NS' },
  { value: 'PTR', label: 'PTR' },
  { value: 'SRV', label: 'SRV' },
];

// Ping types
export const PING_TYPES = [
  { value: 'disco', label: 'Disco' },
  { value: 'TSMP', label: 'TSMP' },
  { value: 'ICMP', label: 'ICMP' },
  { value: 'peerapi', label: 'Peer API' },
];

// Node colors
export const NODE_COLORS = {
  DEFAULT: '#7CA0F4',
  OFFLINE: '#6B7280',
} as const;
