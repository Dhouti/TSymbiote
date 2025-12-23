import { useState, useEffect, useRef, useCallback } from 'react';
import { GraphCanvas, darkTheme } from 'reagraph';
import * as api from './api';
import { FormInput, FormLabel, FormSelect, ModalActionButtons } from './components';
import { Modal } from './components';
import { NodeContextMenu } from './components';
import { SidebarPanel, GraphControls, PingControls, CommandOutputsPanel } from './components';
import {
  useKeyboardShortcuts,
  usePanelResize,
  useWebSocketStream,
  useOnlineFilter,
  useReachableTargets
} from './hooks';
import { getEdgeColorFromResult } from './utils';
import { LAYOUT_OPTIONS, DEFAULT_LAYOUT, NODE_COLORS } from './constants';

interface NodeData {
  exitNode: boolean;
  exitNodeOption: boolean;
  hasSymbiote?: boolean;
  Online?: boolean;
  [key: string]: any; // Allow additional properties from API
}

interface Node {
  id: string;
  label: string;
  data?: NodeData;
}

interface Edge {
  id: string;
  source: string;
  target: string;
}

function App() {
  // Refs
  const nodeRef = useRef(new Map());
  const graphRef = useRef<React.ElementRef<typeof GraphCanvas> | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const contextMenuCloseRef = useRef<(() => void) | null>(null);

  // Core data state
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeColors, setEdgeColors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hosts, setHosts] = useState<string[]>([]);

  // Selection state
  const [selectedHosts, setSelectedHosts] = useState<Set<string>>(new Set());
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [graphKey, setGraphKey] = useState(0);
  const [statusPanelOpen, setStatusPanelOpen] = useState(true);
  const [outputData, setOutputData] = useState<Record<string, any>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  const [selectedOutputHost, setSelectedOutputHost] = useState<string | null>(null);
  const [layoutType, setLayoutType] = useState<string>(DEFAULT_LAYOUT);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [showRawJson, setShowRawJson] = useState(false);
  const [hostSearchFilter, setHostSearchFilter] = useState('');
  const [targetSearchFilter, setTargetSearchFilter] = useState('');
  const [hideOfflinePeers, setHideOfflinePeers] = useState(true);

  // Modal state
  const [showQueryDNSModal, setShowQueryDNSModal] = useState(false);
  const [dnsName, setDnsName] = useState('');
  const [dnsQueryType, setDnsQueryType] = useState('A');
  const [showPprofModal, setShowPprofModal] = useState(false);
  const [pprofType, setPprofType] = useState<api.PprofType>('profile');
  const [pprofDuration, setPprofDuration] = useState('30');

  // Ping settings
  const [pingCount, setPingCount] = useState(5);
  const [pingType, setPingType] = useState<'disco' | 'TSMP' | 'ICMP' | 'peerapi'>('disco');
  const [pingDelay, setPingDelay] = useState(200); // milliseconds, max 2000
  const [showPingSettings, setShowPingSettings] = useState(false);

  // Custom hooks
  const {
    statusPanelHeight,
    setStatusPanelHeight,
    previousPanelHeight,
    setPreviousPanelHeight,
    isDragging,
    toggleMinimizePanel,
    handleResizeStart,
  } = usePanelResize();

  const {
    streamData,
    isStreaming,
    startStream,
    cancelStreaming,
  } = useWebSocketStream();

  const { filterOnline } = useOnlineFilter(nodes);

  // Modal close handlers for keyboard shortcuts
  const closeQueryDNSModal = useCallback(() => {
    setShowQueryDNSModal(false);
    setDnsName('');
    setDnsQueryType('A');
  }, []);

  const closePprofModal = useCallback(() => {
    setShowPprofModal(false);
    setPprofType('profile');
    setPprofDuration('30');
  }, []);

  // Compute target nodes and reachable targets
  const { targetNodes, reachableTargets } = useReachableTargets(
    nodes,
    hosts,
    edges,
    selectedHosts,
    hideOfflinePeers
  );

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    graphRef,
    nodeRef,
    contextMenuCloseRef,
    showQueryDNSModal,
    showPprofModal,
    statusPanelHeight,
    previousPanelHeight,
    statusPanelOpen,
    setStatusPanelHeight,
    setPreviousPanelHeight,
    outputData,
    selectedOutputHost,
    setSelectedOutputHost,
    layoutType,
    layoutOptions: LAYOUT_OPTIONS,
    setLayoutType,
    hosts,
    targetNodes,
    setSelectedHosts,
    setSelectedTargets,
    setGraphKey,
    closeQueryDNSModal,
    closePprofModal,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First, fetch hosts
        const hostsData = await api.fetchHosts();
        console.log('Hosts data:', hostsData);

        // API returns { hosts: string[] }
        const hostList = Array.isArray(hostsData) ? hostsData : hostsData.hosts || [];
        setHosts(hostList);

        // Select all hosts by default
        setSelectedHosts(new Set(hostList));

        // Now fetch peer map with hosts data available
        const data = await api.fetchPeermap();
        console.log('Parsed data:', data);

        // Transform API data to graph format
        if (data && data.nodes && data.edges) {
          console.log('Setting nodes and edges:', data.nodes.length, data.edges.length);

          // Transform nodes to include PeerStatus data
          const transformedNodes = data.nodes.map((nodeData) => {
            // Set grey color for offline nodes
            const fillColor = nodeData.data && nodeData.data.Online === false
              ? NODE_COLORS.OFFLINE
              : NODE_COLORS.DEFAULT;

            return {
              id: nodeData.id,
              label: nodeData.label,
              fill: fillColor,
              size: 7,
              data: {
                ...nodeData.data,
                hasSymbiote: hostList.includes(nodeData.id), // Set based on hosts list
                exitNode: nodeData.data.ExitNode || false,
                exitNodeOption: nodeData.data.ExitNodeOption || false,
              }
            };
          });

          setNodes(transformedNodes);
          setEdges(data.edges);
        } else {
          console.error('Unexpected API response format:', data);
          setError(`Unexpected API response format. Received: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(errorMsg);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Select all targets by default when nodes and hosts are loaded
  useEffect(() => {
    if (nodes.length > 0 && hosts.length > 0) {
      const targetNodes = nodes
        .map(node => node.id)
        .filter(nodeId => !hosts.includes(nodeId))
        .filter(nodeId => {
          // Respect hideOfflinePeers setting during initial selection
          if (hideOfflinePeers) {
            const node = nodes.find(n => n.id === nodeId);
            return node?.data?.Online !== false;
          }
          return true;
        });

      setSelectedTargets(new Set(targetNodes));
    }
  }, [nodes, hosts, hideOfflinePeers]);

  // Auto-scroll stream output to bottom when new data arrives
  useEffect(() => {
    if (isStreaming && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamData, isStreaming]);

  // Deselect offline peers when "Hide Offline" is enabled
  useEffect(() => {
    if (hideOfflinePeers) {
      setSelectedTargets(prevSelected => {
        const newSelected = new Set(prevSelected);
        // Remove offline peers from selection
        Array.from(newSelected).forEach(targetId => {
          const node = nodes.find(n => n.id === targetId);
          if (node?.data?.Online === false) {
            newSelected.delete(targetId);
          }
        });
        return newSelected;
      });
    }
  }, [hideOfflinePeers, nodes]);

  const toggleHost = (hostId: string) => {
    setSelectedHosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(hostId)) {
        newSet.delete(hostId);
      } else {
        newSet.add(hostId);
      }
      return newSet;
    });
  };

  const toggleAllHosts = () => {
    if (selectedHosts.size === hosts.length) {
      setSelectedHosts(new Set());
    } else {
      setSelectedHosts(new Set(hosts));
    }
  };

  // Filter lists based on search (for display only)
  const filteredHostsForDisplay = hosts.filter(hostId =>
    hostId.toLowerCase().includes(hostSearchFilter.toLowerCase())
  );

  // Apply search filter for display
  const filteredTargetsForDisplay = reachableTargets.filter(targetId =>
    targetId.toLowerCase().includes(targetSearchFilter.toLowerCase())
  );

  // Clean up selected targets that are no longer reachable when hosts change
  useEffect(() => {
    setSelectedTargets(prevSelected => {
      const newSelected = new Set<string>();
      prevSelected.forEach(targetId => {
        if (reachableTargets.includes(targetId)) {
          newSelected.add(targetId);
        }
      });
      // Only update if there's a difference
      if (newSelected.size !== prevSelected.size) {
        return newSelected;
      }
      return prevSelected;
    });
  }, [reachableTargets]);

  // Check if any selected hosts have connecting edges between them
  const selectedHostsHaveEdges = () => {
    if (selectedHosts.size < 2) return false;
    const hostArray = Array.from(selectedHosts);
    for (let i = 0; i < hostArray.length; i++) {
      for (let j = i + 1; j < hostArray.length; j++) {
        const hasEdge = edges.some(edge =>
          (edge.source === hostArray[i] && edge.target === hostArray[j]) ||
          (edge.source === hostArray[j] && edge.target === hostArray[i])
        );
        if (hasEdge) return true;
      }
    }
    return false;
  };

  const toggleTarget = (targetId: string) => {
    setSelectedTargets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(targetId)) {
        newSet.delete(targetId);
      } else {
        newSet.add(targetId);
      }
      return newSet;
    });
  };

  const toggleAllTargets = () => {
    if (selectedTargets.size === reachableTargets.length) {
      setSelectedTargets(new Set());
    } else {
      setSelectedTargets(new Set(reachableTargets));
    }
  };

  const fetchStatus = async () => {
    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('Status');
    const results: Record<string, any> = {};

    try {
      // Use only selected hosts that are online
      const onlineSelectedHosts = filterOnline(selectedHosts);

      if (onlineSelectedHosts.length === 0) {
        setStatusLoading(false);
        return;
      }

      // Send single request with all hosts
      const data = await api.fetchStatus(onlineSelectedHosts);

      // Process array response - each item has host, error, result fields
      if (Array.isArray(data)) {
        data.forEach((statusResult) => {
          const hostName = statusResult.host || 'unknown';
          if (statusResult.error) {
            results[hostName] = { error: statusResult.error };
          } else {
            results[hostName] = statusResult.result;
          }
        });
      }

      setOutputData(results);
      setStatusPanelOpen(true);
      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  // Utility function to get valid host/target combinations for targeted commands
  const getTargetedCombinations = (
    sourceHosts: Set<string>,
    targetPeers: Set<string>,
    edgeList: Edge[]
  ): Array<{ hostId: string; peerId: string }> => {
    const combinations: Array<{ hostId: string; peerId: string }> = [];

    for (const hostId of sourceHosts) {
      // Use selected targets plus selected hosts that have connecting edges
      const targetsForHost = new Set(targetPeers);

      // Add selected hosts that have edges to/from this host
      sourceHosts.forEach(otherHostId => {
        if (otherHostId !== hostId) {
          const hasEdge = edgeList.some(edge =>
            (edge.source === hostId && edge.target === otherHostId) ||
            (edge.source === otherHostId && edge.target === hostId)
          );
          if (hasEdge) {
            targetsForHost.add(otherHostId);
          }
        }
      });

      // Only include combinations with valid edges from host to target
      for (const peerId of targetsForHost) {
        const hasEdge = edgeList.some(edge =>
          edge.source === hostId && edge.target === peerId
        );

        if (hasEdge) {
          combinations.push({ hostId, peerId });
        }
      }
    }

    return combinations;
  };

  const fetchPing = async () => {
    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('Ping');
    const results: Record<string, any> = {};
    const newEdgeColors: Record<string, string> = {};

    try {
      // Filter to only online selected hosts and targets
      const onlineSelectedHosts = new Set(filterOnline(selectedHosts));
      const onlineSelectedTargets = new Set(filterOnline(selectedTargets));

      // Get valid host/target combinations using utility function
      const pingCombinations = getTargetedCombinations(onlineSelectedHosts, onlineSelectedTargets, edges);

      // Group targets by host
      const hostTargetsMap = new Map<string, string[]>();
      pingCombinations.forEach(({ hostId, peerId }) => {
        if (!hostTargetsMap.has(hostId)) {
          hostTargetsMap.set(hostId, []);
        }
        hostTargetsMap.get(hostId)!.push(peerId);
      });

      // Build pingInput with args array
      const pingInput = {
        count: pingCount,
        pingType: pingType,
        delay: `${pingDelay}ms`,
        args: Array.from(hostTargetsMap.entries()).map(([hostId, targets]) => ({
          host: hostId,
          targets: targets
        }))
      };

      // Send single request with all hosts and their targets
      try {
        const data = await api.executePing(pingInput);

        // Process the array of PingResults
        if (data && Array.isArray(data)) {
          data.forEach((pingResult: any) => {
            const { host, target, results: pingResults } = pingResult;

            if (!results[host]) {
              results[host] = {};
            }

            // Store the results array for this target
            results[host][target] = pingResults;

            // Determine edge color based on the last result
            if (pingResults && pingResults.length > 0) {
              const lastResult = pingResults[pingResults.length - 1];
              const edgeId = `${host}-${target}`;
              newEdgeColors[edgeId] = getEdgeColorFromResult(lastResult);
            }
          });
        }
      } catch (err) {
        console.error('Error fetching ping:', err);
        // Mark all targets as errored
        hostTargetsMap.forEach((targets, hostId) => {
          if (!results[hostId]) {
            results[hostId] = {};
          }
          targets.forEach(target => {
            results[hostId][target] = { error: err instanceof Error ? err.message : 'Unknown error' };
          });
        });
      }

      // Update edge colors
      setEdgeColors(prev => ({ ...prev, ...newEdgeColors }));

      setOutputData(results);
      setStatusPanelOpen(true);
      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }
    } catch (err) {
      console.error('Error fetching ping:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchQueryDNS = async () => {
    if (!dnsName.trim()) {
      alert('Please enter a DNS name to query');
      return;
    }

    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('Query DNS');
    const results: Record<string, any> = {};

    try {
      // Use only selected hosts that are online
      const onlineSelectedHosts = filterOnline(selectedHosts);

      if (onlineSelectedHosts.length === 0) {
        setStatusLoading(false);
        alert('No online hosts selected');
        return;
      }

      // Send request with hosts, name, and queryType
      const data = await api.executeQueryDNS({
        hosts: onlineSelectedHosts,
        name: dnsName,
        queryType: dnsQueryType,
      });

      // Process array response
      if (Array.isArray(data)) {
        data.forEach((dnsResult: any) => {
          // Use host from the result, or 'unknown' if not present
          const hostName = dnsResult.host || 'unknown';
          // Store the entire result including error, header, responses, and resolvers
          results[hostName] = {
            error: dnsResult.error,
            header: dnsResult.header,
            responses: dnsResult.responses,
            resolvers: dnsResult.resolvers
          };
        });
      }

      setOutputData(results);
      setStatusPanelOpen(true);
      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }

      // Close modal and reset form
      setShowQueryDNSModal(false);
      setDnsName('');
      setDnsQueryType('A');
    } catch (err) {
      console.error('Error fetching DNS query:', err);
      // Only show alert for non-validation errors (network failures, etc.)
      // Validation errors (HTTP 400) are handled by the API and displayed in results
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchPprof = async () => {
    const needsDuration = pprofType === 'profile' || pprofType === 'threadcreate' || pprofType === 'mutex' || pprofType === 'heap' || pprofType === 'block' || pprofType === 'allocs';
    const allowsZero = ['allocs', 'block', 'heap', 'mutex', 'threadcreate'].includes(pprofType);
    const duration = parseInt(pprofDuration, 10);
    const minDuration = allowsZero ? 0 : 1;

    if (needsDuration && (isNaN(duration) || duration < minDuration || duration > 300)) {
      alert(`Duration must be between ${minDuration} and 300 seconds`);
      return;
    }

    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('Pprof');

    try {
      // Use only selected hosts that are online
      const onlineSelectedHosts = filterOnline(selectedHosts);

      if (onlineSelectedHosts.length === 0) {
        setStatusLoading(false);
        alert('No online hosts selected');
        return;
      }

      // Build the request input
      const pprofInput: api.PprofInput = {
        hosts: onlineSelectedHosts,
        type: pprofType,
      };

      // Only include seconds for profile and trace types
      if (needsDuration) {
        pprofInput.seconds = duration;
      }

      // Send request with hosts, type, and optionally seconds
      const response = await api.executePprof(pprofInput);

      if (!response.ok) {
        alert(`Error: HTTP ${response.status}`);
        setStatusLoading(false);
        return;
      }

      const results: Record<string, any> = {};

      // Fetch pprof file for each host
      await Promise.all(
        onlineSelectedHosts.map(async (hostId) => {
          try {
            const pprofData = await api.fetchPprofFile(hostId);

            results[hostId] = {
              data: pprofData,
              hostname: hostId,
              pprofType: pprofType
            };
          } catch (err) {
            results[hostId] = {
              error: err instanceof Error ? err.message : 'Failed to fetch pprof file',
              pprofType: pprofType
            };
          }
        })
      );

      setOutputData(results);
      setStatusPanelOpen(true);

      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }

      // Close modal
      setShowPprofModal(false);
    } catch (err) {
      console.error('Error fetching pprof:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchPrefs = async () => {
    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('Prefs');
    const results: Record<string, any> = {};

    try {
      // Use only selected hosts that are online
      const onlineSelectedHosts = filterOnline(selectedHosts);

      if (onlineSelectedHosts.length === 0) {
        setStatusLoading(false);
        return;
      }

      // Send single request with all hosts
      const data = await api.fetchPrefs(onlineSelectedHosts);

      // Process array response - each item has host, error, result fields
      if (Array.isArray(data)) {
        data.forEach((prefsResult: any) => {
          const hostName = prefsResult.host || 'unknown';
          if (prefsResult.error) {
            results[hostName] = { error: prefsResult.error };
          } else {
            results[hostName] = prefsResult.result;
          }
        });
      }

      setOutputData(results);
      setStatusPanelOpen(true);
      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }
    } catch (err) {
      console.error('Error fetching prefs:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchDriveShares = async () => {
    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('Drive Shares');
    const results: Record<string, any> = {};

    try {
      // Use only selected hosts that are online
      const onlineSelectedHosts = filterOnline(selectedHosts);

      if (onlineSelectedHosts.length === 0) {
        setStatusLoading(false);
        return;
      }

      // Send single request with all hosts
      const data = await api.fetchDriveShares(onlineSelectedHosts);

      // Process array response - each item has host, error, result fields
      if (Array.isArray(data)) {
        data.forEach((shareResult: any) => {
          const hostName = shareResult.host || 'unknown';
          if (shareResult.error) {
            results[hostName] = { error: shareResult.error };
          } else {
            results[hostName] = shareResult.result;
          }
        });
      }

      setOutputData(results);
      setStatusPanelOpen(true);
      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }
    } catch (err) {
      console.error('Error fetching drive shares:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchDNSConfig = async () => {
    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('DNS Config');
    const results: Record<string, any> = {};

    try {
      // Use only selected hosts that are online
      const onlineSelectedHosts = filterOnline(selectedHosts);

      if (onlineSelectedHosts.length === 0) {
        setStatusLoading(false);
        return;
      }

      // Send single request with all hosts
      const data = await api.fetchDNSConfig(onlineSelectedHosts);

      // Process array response - each item has host, error, result fields
      if (Array.isArray(data)) {
        data.forEach((configResult: any) => {
          const hostName = configResult.host || 'unknown';
          if (configResult.error) {
            results[hostName] = { error: configResult.error };
          } else {
            results[hostName] = configResult.result;
          }
        });
      }

      setOutputData(results);
      setStatusPanelOpen(true);
      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }
    } catch (err) {
      console.error('Error fetching DNS config:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchServeConfig = async () => {
    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('Serve Config');
    const results: Record<string, any> = {};

    try {
      // Use only selected hosts that are online
      const onlineSelectedHosts = filterOnline(selectedHosts);

      if (onlineSelectedHosts.length === 0) {
        setStatusLoading(false);
        return;
      }

      // Send single request with all hosts
      const data = await api.fetchServeConfig(onlineSelectedHosts);

      // Process array response - each item has host, error, result fields
      if (Array.isArray(data)) {
        data.forEach((configResult: any) => {
          const hostName = configResult.host || 'unknown';
          if (configResult.error) {
            results[hostName] = { error: configResult.error };
          } else {
            results[hostName] = configResult.result;
          }
        });
      }

      setOutputData(results);
      setStatusPanelOpen(true);
      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }
    } catch (err) {
      console.error('Error fetching serve config:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchAppConnRoutes = async () => {
    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('AppConn Routes');
    const results: Record<string, any> = {};

    try {
      // Use only selected hosts that are online
      const onlineSelectedHosts = filterOnline(selectedHosts);

      if (onlineSelectedHosts.length === 0) {
        setStatusLoading(false);
        return;
      }

      // Send single request with all hosts
      const data = await api.fetchAppConnRoutes(onlineSelectedHosts);

      // Process array response - each item has host, error, result fields
      if (Array.isArray(data)) {
        data.forEach((routesResult: any) => {
          const hostName = routesResult.host || 'unknown';
          if (routesResult.error) {
            results[hostName] = { error: routesResult.error };
          } else {
            results[hostName] = routesResult.result;
          }
        });
      }

      setOutputData(results);
      setStatusPanelOpen(true);
      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }
    } catch (err) {
      console.error('Error fetching app connector routes:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchGoroutines = async () => {
    cancelStreaming(false);
    setStatusLoading(true);
    setLastCommand('Goroutines');
    const results: Record<string, any> = {};

    try {
      // Use only selected hosts that are online
      const onlineSelectedHosts = filterOnline(selectedHosts);

      if (onlineSelectedHosts.length === 0) {
        setStatusLoading(false);
        return;
      }

      // Send single request with all hosts
      const data = await api.fetchGoroutines(onlineSelectedHosts);

      // Process array response - each item has host, error, result fields
      // result is base64-encoded bytes that need to be decoded to string
      if (Array.isArray(data)) {
        data.forEach((goroutinesResult: any) => {
          const hostName = goroutinesResult.host || 'unknown';
          if (goroutinesResult.error) {
            results[hostName] = { error: goroutinesResult.error };
          } else if (goroutinesResult.result) {
            // Decode base64 to string
            try {
              results[hostName] = atob(goroutinesResult.result);
            } catch {
              results[hostName] = { error: 'Failed to decode goroutines data' };
            }
          } else {
            results[hostName] = { error: 'No data returned' };
          }
        });
      }

      setOutputData(results);
      setStatusPanelOpen(true);
      // Set first host as selected by default
      const firstHost = Object.keys(results)[0];
      if (firstHost) {
        setSelectedOutputHost(firstHost);
      }
    } catch (err) {
      console.error('Error fetching goroutines:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchLogs = () => {
    // Get online selected hosts
    const onlineSelectedHosts = filterOnline(selectedHosts);

    if (onlineSelectedHosts.length === 0) {
      alert('Please select at least one online host');
      return;
    }

    setLastCommand('Logs');
    setStatusPanelOpen(true);

    // Set the first selected host for display
    setSelectedOutputHost(onlineSelectedHosts[0]);
    const streamingStatus: Record<string, any> = {};
    onlineSelectedHosts.forEach(hostId => {
      streamingStatus[hostId] = { streaming: true };
    });
    setOutputData(streamingStatus);

    // Start the log stream using the generic hook
    startStream('Logs', onlineSelectedHosts);
  };

  const fetchBusEvents = () => {
    // Get online selected hosts
    const onlineSelectedHosts = filterOnline(selectedHosts);

    if (onlineSelectedHosts.length === 0) {
      alert('Please select at least one online host');
      return;
    }

    setLastCommand('Bus Events');
    setStatusPanelOpen(true);

    // Set the first selected host for display
    setSelectedOutputHost(onlineSelectedHosts[0]);
    const streamingStatus: Record<string, any> = {};
    onlineSelectedHosts.forEach(hostId => {
      streamingStatus[hostId] = { streaming: true };
    });
    setOutputData(streamingStatus);

    // Start the bus events stream using the generic hook
    startStream('BusEvents', onlineSelectedHosts);
  };

  // Filter edges first - only show edges where source is selected
  const filteredEdges = edges
    .filter((edge) => {
      return selectedHosts.has(edge.source);
    })
    .map((edge) => {
      // Apply color from edgeColors state if available
      const edgeId = `${edge.source}-${edge.target}`;
      const color = edgeColors[edgeId];

      if (color) {
        // reagraph uses 'fill' for edge colors
        return { ...edge, fill: color };
      }
      return edge;
    });

  // Show selected hosts, and selected targets only if at least one host is selected
  const filteredNodes = nodes.filter((node) => {
    // Always show selected hosts
    if (selectedHosts.has(node.id)) return true;

    // Only show selected targets if at least one host is selected
    if (selectedTargets.has(node.id) && selectedHosts.size > 0) return true;

    return false;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black dark:from-black dark:via-gray-950 dark:to-zinc-950">
      {/* Sidebar */}
      <SidebarPanel
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        hosts={hosts}
        selectedHosts={selectedHosts}
        toggleHost={toggleHost}
        toggleAllHosts={toggleAllHosts}
        hostSearchFilter={hostSearchFilter}
        setHostSearchFilter={setHostSearchFilter}
        filteredHostsForDisplay={filteredHostsForDisplay}
        selectedTargets={selectedTargets}
        toggleTarget={toggleTarget}
        toggleAllTargets={toggleAllTargets}
        targetSearchFilter={targetSearchFilter}
        setTargetSearchFilter={setTargetSearchFilter}
        filteredTargetsForDisplay={filteredTargetsForDisplay}
        reachableTargets={reachableTargets}
        hideOfflinePeers={hideOfflinePeers}
        setHideOfflinePeers={setHideOfflinePeers}
        fetchStatus={fetchStatus}
        fetchPrefs={fetchPrefs}
        fetchDriveShares={fetchDriveShares}
        fetchDNSConfig={fetchDNSConfig}
        fetchServeConfig={fetchServeConfig}
        fetchAppConnRoutes={fetchAppConnRoutes}
        fetchLogs={fetchLogs}
        fetchBusEvents={fetchBusEvents}
        openQueryDNSModal={() => setShowQueryDNSModal(true)}
        openPprofModal={() => setShowPprofModal(true)}
        statusLoading={statusLoading}
        isStreaming={isStreaming}
      />

      {/* Graph Controls - Top Right */}
      <GraphControls
        layoutType={layoutType}
        setLayoutType={setLayoutType}
        onReset={() => {
          nodeRef.current.clear();
          setLayoutType(DEFAULT_LAYOUT);
          setSelectedHosts(new Set(hosts));
          setSelectedTargets(new Set(targetNodes));
          setGraphKey((prev) => prev + 1);
        }}
        onFitToView={() => graphRef.current?.fitNodesInView()}
      />

      <main className={`h-screen transition-all duration-300 ${sidebarOpen ? 'ml-120' : 'ml-12'} relative`}>
        {/* Ping Controls - Top Left of Graph */}
        <PingControls
          onPing={fetchPing}
          disabled={selectedHosts.size === 0 || (selectedTargets.size === 0 && !selectedHostsHaveEdges()) || statusLoading}
          loading={statusLoading}
          showPingSettings={showPingSettings}
          setShowPingSettings={setShowPingSettings}
          pingCount={pingCount}
          setPingCount={setPingCount}
          pingType={pingType}
          setPingType={setPingType}
          pingDelay={pingDelay}
          setPingDelay={setPingDelay}
        />

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-white text-xl">Loading peer map...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400 text-xl">Error: {error}</div>
          </div>
        ) : nodes.length > 0 ? (
          <GraphCanvas
            ref={graphRef}
            key={graphKey}
            nodes={filteredNodes}
            edges={filteredEdges}
            layoutType={layoutType as any}
            theme={darkTheme}
            cameraMode="rotate"
            draggable
            layoutOverrides={{
              getNodePosition: (id: string) => {
                return nodeRef.current.get(id)?.position;
              }
            }}
            onNodeDragged={(node: any) => {
              console.log('Node dragged:', node);
              nodeRef.current.set(node.id, node);
            }}
            renderNode={({ node, position }: any) => (
              <group position={position}>
                {/* Render node with different geometry for symbiote nodes */}
                <mesh>
                  {node.data?.hasSymbiote ? (
                    <icosahedronGeometry args={[(node.size || 7) * 1.5, 0]} />
                  ) : (
                    <sphereGeometry args={[node.size || 7, 32, 32]} />
                  )}
                  <meshMatcapMaterial color={node.fill || NODE_COLORS.DEFAULT} opacity={1.0} transparent={false} />
                </mesh>
              </group>
            )}
            contextMenu={({ data, onClose }: any) => {
              // Only show context menu for nodes, not edges
              if (!data || !data.data || (data as any).source || (data as any).target) {
                contextMenuCloseRef.current = null;
                return null;
              }
              contextMenuCloseRef.current = onClose;
              // Only show filter button for hosts
              const isHost = hosts.includes(data.id);
              return (
                <NodeContextMenu
                  data={data}
                  onClose={onClose}
                  onFilterToHost={isHost ? () => setSelectedHosts(new Set([data.id])) : undefined}
                />
              );
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 text-xl">No nodes to display</div>
          </div>
        )}
      </main>

      {/* Command Outputs Panel */}
      {statusPanelOpen && (
        <CommandOutputsPanel
          sidebarOpen={sidebarOpen}
          statusPanelHeight={statusPanelHeight}
          isDragging={isDragging}
          handleResizeStart={handleResizeStart}
          toggleMinimizePanel={toggleMinimizePanel}
          outputData={outputData}
          selectedOutputHost={selectedOutputHost}
          setSelectedOutputHost={setSelectedOutputHost}
          lastCommand={lastCommand}
          statusLoading={statusLoading}
          streamData={streamData}
          logsEndRef={logsEndRef}
          isStreaming={isStreaming}
          cancelStreaming={cancelStreaming}
          showRawJson={showRawJson}
          setShowRawJson={setShowRawJson}
        />
      )}

      {/* Query DNS Modal */}
      {showQueryDNSModal && (
        <Modal
          title="Query DNS"
          onClose={() => { setShowQueryDNSModal(false); setDnsName(''); setDnsQueryType('A'); }}
          onSubmit={() => { if (dnsName.trim() && !statusLoading) fetchQueryDNS(); }}
        >
          <div>
            <FormLabel>Name</FormLabel>
            <FormInput value={dnsName} onChange={(e) => setDnsName(e.target.value)} placeholder="example.com" autoFocus />
          </div>
          <div>
            <FormLabel>Query Type</FormLabel>
            <FormSelect
              value={dnsQueryType}
              onChange={(e) => setDnsQueryType(e.target.value)}
              options={[
                { value: 'A', label: 'A' }, { value: 'AAAA', label: 'AAAA' }, { value: 'CNAME', label: 'CNAME' },
                { value: 'MX', label: 'MX' }, { value: 'NS', label: 'NS' }, { value: 'PTR', label: 'PTR' },
                { value: 'SOA', label: 'SOA' }, { value: 'SRV', label: 'SRV' }, { value: 'TXT', label: 'TXT' }
              ]}
            />
          </div>
          <ModalActionButtons
            onCancel={() => { setShowQueryDNSModal(false); setDnsName(''); setDnsQueryType('A'); }}
            onSubmit={fetchQueryDNS}
            submitText="Query"
            submitDisabled={!dnsName.trim() || statusLoading}
          />
        </Modal>
      )}

      {/* Pprof Modal */}
      {showPprofModal && (
        <Modal
          title="Pprof"
          onClose={closePprofModal}
          onSubmit={() => {
            if (!statusLoading) {
              if (pprofType === 'goroutine') {
                fetchGoroutines();
                closePprofModal();
              } else {
                fetchPprof();
              }
            }
          }}
        >
          <div>
            <FormLabel>Type</FormLabel>
            <FormSelect
              value={pprofType}
              onChange={(e) => {
                const newType = e.target.value as api.PprofType;
                setPprofType(newType);
                if (['allocs', 'block', 'heap', 'mutex', 'threadcreate'].includes(newType)) {
                  setPprofDuration('0');
                } else if (newType === 'profile') {
                  setPprofDuration('30');
                }
              }}
              options={[
                { value: 'profile', label: 'Profile (CPU)' },
                { value: 'heap', label: 'Heap' },
                { value: 'allocs', label: 'Allocs' },
                { value: 'goroutine', label: 'Goroutine' },
                { value: 'block', label: 'Block' },
                { value: 'mutex', label: 'Mutex' },
                { value: 'threadcreate', label: 'Thread Create' },
              ]}
            />
          </div>
          {(pprofType === 'profile' || pprofType === 'threadcreate' || pprofType === 'mutex' || pprofType === 'heap' || pprofType === 'block' || pprofType === 'allocs') && (
            <div>
              <FormLabel>Duration (seconds)</FormLabel>
              <FormInput type="number" value={pprofDuration} onChange={(e) => setPprofDuration(e.target.value)} min={['allocs', 'block', 'heap', 'mutex', 'threadcreate'].includes(pprofType) ? 0 : 1} max={300} />
              <p className="text-gray-400 text-xs mt-1">Valid range: {['allocs', 'block', 'heap', 'mutex', 'threadcreate'].includes(pprofType) ? '0' : '1'}-300 seconds</p>
            </div>
          )}
          <ModalActionButtons
            onCancel={closePprofModal}
            onSubmit={() => {
              if (pprofType === 'goroutine') {
                fetchGoroutines();
                closePprofModal();
              } else {
                fetchPprof();
              }
            }}
            submitText="Start"
            submitDisabled={statusLoading}
          />
        </Modal>
      )}
    </div>
  );
}

export default App;
