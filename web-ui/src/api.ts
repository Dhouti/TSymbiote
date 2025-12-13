// API Service Layer
// Handles all external API calls for the TSymbiote application

// API base URL - relative in production, port 3621 in development
export const getApiBaseUrl = (): string => {
  return import.meta.env.PROD
    ? `${window.location.protocol}//${window.location.host}`
    : `${window.location.protocol}//${window.location.hostname}:3621`;
};

// Types
export interface HostsResponse {
  hosts: string[];
}

// PeerMap types
export interface PeerNodeData {
  Active: boolean;
  Addrs: string[] | null;
  AllowedIPs: string[];
  CapMap?: Record<string, any[] | null>;
  Created: string;
  CurAddr: string;
  DNSName: string;
  ExitNode: boolean;
  ExitNodeOption: boolean;
  HostName: string;
  ID: string;
  InEngine: boolean;
  InMagicSock: boolean;
  InNetworkMap: boolean;
  KeyExpiry?: string;
  LastHandshake: string;
  LastSeen: string;
  LastWrite: string;
  NoFileSharingReason: string;
  OS: string;
  Online: boolean;
  PeerAPIURL: string[];
  PeerRelay: string;
  PrimaryRoutes?: string[];
  PublicKey: string;
  Relay: string;
  RxBytes: number;
  Tags?: string[];
  TaildropTarget: number;
  TailscaleIPs: string[];
  TxBytes: number;
  UserID: number;
}

export interface PeerNode {
  id: string;
  label: string;
  data: PeerNodeData;
}

export interface PeerEdge {
  id: string;
  source: string;
  target: string;
}

export interface PeermapResponse {
  edges: PeerEdge[];
  nodes: PeerNode[];
}

export interface StatusData {
  Self?: {
    HostName?: string;
    [key: string]: any;
  };
  Peer?: Record<string, any>;
  User?: Record<string, any>;
  Version?: string;
  BackendState?: string;
  TUN?: boolean;
  CurrentTailnet?: {
    Name?: string;
    MagicDNSEnabled?: boolean;
    MagicDNSSuffix?: string;
  };
  Health?: string[];
  TailscaleIPs?: string[];
  MagicDNSSuffix?: string;
  CertDomains?: string[];
  HaveNodeKey?: boolean;
  AuthURL?: string;
  [key: string]: any;
}

export interface PingInput {
  count: number;
  pingType: string;
  delay: string;
  args: Array<{
    host: string;
    targets: string[];
  }>;
}

export interface PingResult {
  host: string;
  target: string;
  results: any[];
}

export interface QueryDNSInput {
  hosts: string[];
  name: string;
  queryType: string;
}

export interface QueryDNSResult {
  host: string;
  error?: string;
  header?: any;
  responses?: any[];
  resolvers?: any[];
}

export type PprofType = 'profile' | 'allocs' | 'block' | 'heap' | 'mutex' | 'threadcreate' | 'goroutine' | 'cmdline' | 'trace';

export interface PprofInput {
  hosts: string[];
  type: PprofType;
  seconds?: number; // Only used for 'profile' and 'trace' types
}

export interface PrefsData {
  Hostname?: string;
  AdvertiseRoutes?: string[];
  AdvertiseServices?: string[] | null;
  AdvertiseTags?: string[] | null;
  ControlURL?: string;
  CorpDNS?: boolean;
  ExitNodeAllowLANAccess?: boolean;
  ExitNodeID?: string;
  ForceDaemon?: boolean;
  LoggedOut?: boolean;
  NetfilterMode?: number;
  NoSNAT?: boolean;
  NoStatefulFiltering?: boolean;
  RouteAll?: boolean;
  RunSSH?: boolean;
  RunWebClient?: boolean;
  ShieldsUp?: boolean;
  WantRunning?: boolean;
  AutoUpdate?: {
    Apply?: boolean | null;
    Check?: boolean;
  };
  AppConnector?: {
    Advertise?: boolean;
  };
  Persist?: {
    NodeID?: string;
    UserProfile?: {
      DisplayName?: string;
      ID?: number;
      LoginName?: string;
      ProfilePicURL?: string;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export interface DriveShare {
  Name?: string;
  Path?: string;
  Who?: string;
  BookmarkData?: string; // base64 encoded bytes
}

export interface DNSOSConfig {
  Nameservers?: string[];
  SearchDomains?: string[];
  MatchDomains?: string[];
}

export interface TCPPortHandler {
  HTTPS?: boolean;
  HTTP?: boolean;
  TCPForward?: string;
  TerminateTLS?: string;
}

export interface WebServerConfig {
  Handlers?: Record<string, WebHandler>;
}

export interface WebHandler {
  Path?: string;
  Proxy?: string;
  Text?: string;
}

export interface ServiceConfig {
  TCP?: Record<number, TCPPortHandler>;
  Web?: Record<string, WebServerConfig>;
}

export interface ServeConfig {
  TCP?: Record<number, TCPPortHandler> | null;
  Web?: Record<string, WebServerConfig> | null;
  Services?: Record<string, ServiceConfig> | null;
  AllowFunnel?: Record<string, boolean> | null;
  Foreground?: Record<string, ServeConfig> | null;
  ETag?: string;
}

export interface RouteInfo {
  Control?: string[] | null;
  Domains?: Record<string, string[]> | null;
  Wildcards?: string[] | null;
}

// API Functions

/**
 * Generic result type for host-based API responses
 */
export interface HostResult<T> {
  host: string;
  error?: string;
  result?: T;
}

/**
 * Generic fetch function for host-based POST APIs
 * Used by: status, prefs, serveconfig, dnsconfig, appconnroutes, driveshares, goroutines
 */
export async function fetchHostData<T>(endpoint: string, hosts: string[]): Promise<HostResult<T>[]> {
  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hosts }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch list of available hosts
 */
export async function fetchHosts(): Promise<HostsResponse> {
  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}/api/Hosts`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch peer map data
 */
export async function fetchPeermap(): Promise<PeermapResponse> {
  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}/api/PeerMap`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch status for selected hosts
 */
export const fetchStatus = (hosts: string[]) => fetchHostData<StatusData>('Status', hosts);

/**
 * Execute ping command
 */
export async function executePing(input: PingInput): Promise<PingResult[]> {
  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}/api/Ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Execute DNS query
 * Returns error results for HTTP 400 (validation errors) instead of throwing
 */
export async function executeQueryDNS(input: QueryDNSInput): Promise<QueryDNSResult[]> {
  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}/api/QueryDNS`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  // For HTTP 400 (validation errors), try to parse error response and return as results
  if (response.status === 400) {
    try {
      const errorData = await response.json();
      // If the error response has an error field, wrap it as results for each host
      if (errorData.error) {
        return input.hosts.map(host => ({
          host,
          error: errorData.error
        }));
      }
      // If it's already an array of results with errors, return as-is
      if (Array.isArray(errorData)) {
        return errorData;
      }
    } catch {
      // If we can't parse the error body, fall through to throw
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Execute pprof sampling
 */
export async function executePprof(input: PprofInput): Promise<Response> {
  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}/api/Pprof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
}

/**
 * Fetch pprof file for a specific host
 */
export async function fetchPprofFile(hostId: string): Promise<ArrayBuffer> {
  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}/${hostId}.pprof`);

  if (!response.ok) {
    throw new Error(`Failed to fetch pprof file: HTTP ${response.status}`);
  }

  return response.arrayBuffer();
}

/**
 * Fetch preferences for selected hosts
 */
export const fetchPrefs = (hosts: string[]) => fetchHostData<PrefsData>('Prefs', hosts);

/**
 * Fetch serve config for selected hosts
 */
export const fetchServeConfig = (hosts: string[]) => fetchHostData<ServeConfig>('ServeConfig', hosts);

/**
 * Fetch DNS config for selected hosts
 */
export const fetchDNSConfig = (hosts: string[]) => fetchHostData<DNSOSConfig>('DNSConfig', hosts);

/**
 * Fetch drive shares for selected hosts
 */
export const fetchDriveShares = (hosts: string[]) => fetchHostData<{ Shares?: DriveShare[] }>('DriveShares', hosts);

/**
 * Fetch app connector routes for selected hosts
 */
export const fetchAppConnRoutes = (hosts: string[]) => fetchHostData<RouteInfo>('AppConnRoutes', hosts);

/**
 * Fetch goroutines for selected hosts
 */
export const fetchGoroutines = (hosts: string[]) => fetchHostData<string>('Goroutines', hosts);

/**
 * Stream types for WebSocket connections
 */
export type WebSocketStreamType = 'Logs' | 'BusEvents';

/**
 * Get WebSocket URL for streaming endpoints
 */
export function getStreamWebSocketUrl(streamType: WebSocketStreamType, hostIds: string[]): string {
  const API_BASE_URL = getApiBaseUrl();
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = API_BASE_URL.replace(/^https?:/, wsProtocol);
  return `${wsHost}/api/${streamType}?hosts=${encodeURIComponent(hostIds.join(','))}`;
}

/**
 * Get WebSocket URL for log streaming (legacy, uses getStreamWebSocketUrl)
 */
export function getLogsWebSocketUrl(hostIds: string[]): string {
  return getStreamWebSocketUrl('Logs', hostIds);
}

/**
 * Get WebSocket URL for bus events streaming
 */
export function getBusEventsWebSocketUrl(hostIds: string[]): string {
  return getStreamWebSocketUrl('BusEvents', hostIds);
}

