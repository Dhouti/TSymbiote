/**
 * Utility functions for command handling in TSymbiote
 */

// Edge colors for different connection types
export const EDGE_COLORS = {
  DIRECT: '#22c55e',      // green
  PEER_API: '#3b82f6',    // blue
  PEER_RELAY: '#9333ea',  // purple
  DERP: '#ea580c',        // orange
} as const;

// Badge colors for UI display (Tailwind classes)
export const CONNECTION_BADGE_COLORS = {
  DIRECT: 'bg-green-600',
  PEER_API: 'bg-blue-600',
  PEER_RELAY: 'bg-purple-600',
  DERP: 'bg-orange-600',
  UNKNOWN: 'bg-gray-600',
} as const;

export interface ConnectionTypeInfo {
  label: string;
  color: string;
  edgeColor: string;
}

/**
 * Determine connection type from a ping result
 * Returns both display label/color and edge color for graph
 */
export function getConnectionType(result: any): ConnectionTypeInfo {
  if (!result) {
    return {
      label: 'unknown',
      color: CONNECTION_BADGE_COLORS.UNKNOWN,
      edgeColor: EDGE_COLORS.DIRECT,
    };
  }

  if (result.PeerRelay && result.PeerRelay !== '') {
    return {
      label: 'peer-relay',
      color: CONNECTION_BADGE_COLORS.PEER_RELAY,
      edgeColor: EDGE_COLORS.PEER_RELAY,
    };
  }

  if (result.DERPRegionID && result.DERPRegionID !== 0) {
    return {
      label: 'DERP',
      color: CONNECTION_BADGE_COLORS.DERP,
      edgeColor: EDGE_COLORS.DERP,
    };
  }

  if (result.PeerAPIURL && result.PeerAPIURL !== '') {
    return {
      label: 'peer-api',
      color: CONNECTION_BADGE_COLORS.PEER_API,
      edgeColor: EDGE_COLORS.PEER_API,
    };
  }

  return {
    label: 'direct',
    color: CONNECTION_BADGE_COLORS.DIRECT,
    edgeColor: EDGE_COLORS.DIRECT,
  };
}

/**
 * Get edge color from a ping result (for graph coloring)
 */
export function getEdgeColorFromResult(result: any): string {
  return getConnectionType(result).edgeColor;
}
