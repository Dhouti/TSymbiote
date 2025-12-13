import { useMemo, useCallback } from 'react';

interface Node {
  id: string;
  label: string;
  data?: {
    Online?: boolean;
    [key: string]: any;
  };
}

/**
 * Hook for filtering nodes/hosts by online status
 */
export function useOnlineFilter(nodes: Node[]) {
  /**
   * Check if a node is online
   */
  const isOnline = useCallback((nodeId: string): boolean => {
    const node = nodes.find(n => n.id === nodeId);
    return node?.data?.Online !== false;
  }, [nodes]);

  /**
   * Filter a set of IDs to only include online nodes
   */
  const filterOnline = useCallback((ids: Set<string> | string[]): string[] => {
    const idArray = Array.isArray(ids) ? ids : Array.from(ids);
    return idArray.filter(id => isOnline(id));
  }, [isOnline]);

  /**
   * Get online hosts from a selection
   */
  const getOnlineFromSet = useCallback((selectedSet: Set<string>): string[] => {
    return filterOnline(selectedSet);
  }, [filterOnline]);

  return {
    isOnline,
    filterOnline,
    getOnlineFromSet,
  };
}

/**
 * Hook for computing reachable targets based on selected hosts and edges
 */
export function useReachableTargets(
  nodes: Node[],
  hosts: string[],
  edges: Array<{ source: string; target: string }>,
  selectedHosts: Set<string>,
  hideOfflinePeers: boolean
) {
  const { isOnline } = useOnlineFilter(nodes);

  // Get all target nodes (nodes that aren't hosts)
  const targetNodes = useMemo(() => {
    return nodes
      .map(node => node.id)
      .filter(nodeId => !hosts.includes(nodeId));
  }, [nodes, hosts]);

  // Only show targets that have at least one edge to a selected host
  const reachableTargetsBase = useMemo(() => {
    if (selectedHosts.size === 0) return [];

    return targetNodes.filter(targetId => {
      // Check if there's an edge from any selected host to this target
      return Array.from(selectedHosts).some(hostId =>
        edges.some(edge => edge.source === hostId && edge.target === targetId)
      );
    });
  }, [targetNodes, selectedHosts, edges]);

  // Apply hide offline filter to reachable targets
  const reachableTargets = useMemo(() => {
    if (!hideOfflinePeers) return reachableTargetsBase;

    return reachableTargetsBase.filter(targetId => isOnline(targetId));
  }, [reachableTargetsBase, hideOfflinePeers, isOnline]);

  return {
    targetNodes,
    reachableTargets,
  };
}
