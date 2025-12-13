import { type RefObject } from 'react';
import {
  formatBytes,
  formatTimestamp,
  formatLatency,
  StatusBadge,
  FieldRow,
  ListSection,
  TagBadges,
  ControlLegendItem,
  ToggleSwitch,
  CopyButton,
  JsonSyntaxHighlighter,
  GoStackTraceSyntaxHighlighter,
} from './';
import { PprofViewer } from './';
import { getConnectionType } from '../utils';
import { PANEL_CONFIG } from '../constants';

interface CommandOutputsPanelProps {
  // Panel state
  sidebarOpen: boolean;
  statusPanelHeight: number;
  isDragging: boolean;
  handleResizeStart: (e: React.MouseEvent) => void;
  toggleMinimizePanel: () => void;

  // Output data
  outputData: Record<string, any>;
  selectedOutputHost: string | null;
  setSelectedOutputHost: (host: string) => void;
  lastCommand: string;
  statusLoading: boolean;

  // Stream data (for Logs and Debug Events)
  streamData: Record<string, string>;
  logsEndRef: RefObject<HTMLDivElement | null>;
  isStreaming: boolean;
  cancelStreaming: () => void;

  // Display options
  showRawJson: boolean;
  setShowRawJson: (show: boolean) => void;
}

export const CommandOutputsPanel = ({
  sidebarOpen,
  statusPanelHeight,
  isDragging,
  handleResizeStart,
  toggleMinimizePanel,
  outputData,
  selectedOutputHost,
  setSelectedOutputHost,
  lastCommand,
  statusLoading,
  streamData,
  logsEndRef,
  isStreaming,
  cancelStreaming,
  showRawJson,
  setShowRawJson,
}: CommandOutputsPanelProps) => {
  return (
    <div
      className={`fixed bottom-0 ${sidebarOpen ? 'left-120' : 'left-12'} right-0 bg-gray-800 border-t border-gray-700 transition-all duration-300 z-30 flex flex-col`}
      style={{ height: `${statusPanelHeight}px`, minHeight: '180px' }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute top-0 left-0 right-0 h-2 transition-colors cursor-ns-resize ${
          isDragging ? 'bg-green-500' : 'bg-gray-700 hover:bg-gray-600'
        }`}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-gray-500 rounded"></div>
      </div>

      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 mt-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold text-2xl">
            Command Outputs
            {lastCommand && <span className="text-gray-400 font-normal ml-2">- {lastCommand}</span>}
          </h3>
          {isStreaming && (
            <button
              onClick={() => cancelStreaming()}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <ToggleSwitch checked={showRawJson} onChange={() => setShowRawJson(!showRawJson)} label="Raw JSON" />
          <button
            onClick={toggleMinimizePanel}
            className="text-gray-400 hover:text-white transition-colors"
            title={statusPanelHeight <= PANEL_CONFIG.MIN_HEIGHT ? "Restore panel" : "Minimize panel"}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={statusPanelHeight <= PANEL_CONFIG.MIN_HEIGHT ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      {Object.keys(outputData).length > 0 && (
        <div className="flex overflow-x-auto border-b border-gray-700 flex-shrink-0">
          {Object.keys(outputData).map((hostId) => (
            <button
              key={hostId}
              onClick={() => setSelectedOutputHost(hostId)}
              className={`px-4 py-3 text-base font-medium whitespace-nowrap transition-colors ${
                selectedOutputHost === hostId
                  ? 'text-white bg-gray-900 border-b-2 border-green-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {hostId}
            </button>
          ))}
        </div>
      )}

      {/* Panel Content */}
      <div
        className="flex flex-col overflow-auto"
        style={{ flex: '1 1 0', minHeight: 0 }}
      >
        {statusLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-lg">Loading...</p>
          </div>
        ) : Object.keys(outputData).length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-lg">No command output yet. Run a command to see results.</p>
          </div>
        ) : selectedOutputHost && outputData[selectedOutputHost] ? (
            <div className="p-6">
              {outputData[selectedOutputHost].error ? (
                <div className="text-red-400 p-4 bg-gray-900 rounded">
                  Error: {outputData[selectedOutputHost].error}
                </div>
              ) : showRawJson ? (
                <div className="relative">
                  <CopyButton text={JSON.stringify(outputData[selectedOutputHost], null, 2)} />
                  <JsonSyntaxHighlighter data={outputData[selectedOutputHost]} />
                </div>
              ) : lastCommand === 'Ping' ? (
                <PingResultsContent data={outputData[selectedOutputHost]} />
              ) : lastCommand === 'Query DNS' ? (
                <QueryDNSResultsContent data={outputData[selectedOutputHost]} />
              ) : lastCommand === 'Pprof' ? (
                <PprofResultsContent data={outputData[selectedOutputHost]} />
              ) : lastCommand === 'Prefs' ? (
                <PrefsResultsContent data={outputData[selectedOutputHost]} />
              ) : lastCommand === 'Drive Shares' ? (
                <DriveSharesResultsContent data={outputData[selectedOutputHost]} />
              ) : lastCommand === 'DNS Config' ? (
                <DNSConfigResultsContent data={outputData[selectedOutputHost]} />
              ) : lastCommand === 'Serve Config' ? (
                <ServeConfigResultsContent data={outputData[selectedOutputHost]} />
              ) : lastCommand === 'AppConn Routes' ? (
                <AppConnRoutesResultsContent data={outputData[selectedOutputHost]} />
              ) : lastCommand === 'Goroutines' ? (
                <GoroutinesResultsContent data={outputData[selectedOutputHost]} />
              ) : lastCommand === 'Logs' ? (
                <StreamResultsContent
                  streamData={streamData}
                  selectedOutputHost={selectedOutputHost}
                  isStreaming={isStreaming}
                  streamEndRef={logsEndRef}
                  title="Logs"
                />
              ) : lastCommand === 'Bus Events' ? (
                <StreamResultsContent
                  streamData={streamData}
                  selectedOutputHost={selectedOutputHost}
                  isStreaming={isStreaming}
                  streamEndRef={logsEndRef}
                  title="Bus Events"
                />
              ) : (
                <StatusResultsContent data={outputData[selectedOutputHost]} />
              )}
            </div>
        ) : null}
      </div>

      {/* Controls Legend */}
      <div className="flex-shrink-0 border-t border-gray-700 p-3">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-400">
          <ControlLegendItem keys={['W', 'A', 'S', 'D']} label="Pan" />
          <ControlLegendItem keys={['R']} label="Reset" />
          <ControlLegendItem keys={['F']} label="Fit to view" />
          <ControlLegendItem keys={['Esc']} label="Close menus" />
          <ControlLegendItem keys={['~']} label="Cycle layouts" />
          <ControlLegendItem keys={['Tab']} label="Cycle outputs" />
          <ControlLegendItem keys={['Space']} label="Toggle panel" />
          <ControlLegendItem keys={['Scroll']} label="Zoom" />
          <ControlLegendItem keys={['L-Drag']} label="Rotate/Move" />
          <ControlLegendItem keys={['R-Drag']} label="Pan" />
          <ControlLegendItem keys={['R-Click']} label="Context" />
        </div>
      </div>
    </div>
  );
};

// Ping Results Component
const PingResultsContent = ({ data }: { data: any }) => {
  // Handle top-level error for the host
  if (data.error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
        <p className="text-red-300">{data.error}</p>
      </div>
    );
  }

  // Filter out the error field and process remaining peer data
  const peerEntries = Object.entries(data).filter(([key]) => key !== 'error' && key !== 'host');

  if (peerEntries.length === 0) {
    return <p className="text-gray-500">No ping results available.</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {peerEntries.map(([peerId, peerData]: [string, any]) => {
        const pingResults = Array.isArray(peerData) ? peerData : [peerData];
        const lastResult = pingResults[pingResults.length - 1];
        const headerConnectionType = lastResult ? getConnectionType(lastResult) : null;

        return (
          <div key={peerId} className="bg-gray-900 rounded-lg border border-gray-700 flex-shrink-0" style={{ minWidth: '250px', maxWidth: '300px' }}>
            {/* Header with peer name */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50">
              <h4 className="text-white font-semibold text-base truncate min-w-0 flex-1">
                {peerId}
              </h4>
              {headerConnectionType && (
                <span className={`text-sm px-2 py-0.5 rounded ${headerConnectionType.color} text-white font-medium flex-shrink-0 ml-2`}>
                  {headerConnectionType.label}
                </span>
              )}
            </div>

            {/* Compact details */}
            {pingResults.map((result: any, idx: number) => {
              const connectionType = getConnectionType(result);

              return (
                <div key={idx} className="px-3 py-2 border-b border-gray-800 last:border-b-0">
                  {!result ? (
                    <div className="text-gray-400 text-sm bg-gray-900/20 px-2 py-1 rounded">
                      No data
                    </div>
                  ) : result.error || result.Err ? (
                    <div className="text-red-400 text-sm bg-red-900/20 px-2 py-1 rounded">
                      Error: {result.error || result.Err}
                    </div>
                  ) : (
                    <div>
                      {/* Connection type badge for each entry */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <span className={`text-sm px-1.5 py-0.5 rounded ${connectionType.color} text-white font-medium`}>
                            {connectionType.label}
                          </span>
                          {result.IsLocalIP && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600 text-white">
                              Local
                            </span>
                          )}
                        </div>
                        {result.LatencySeconds !== undefined && result.LatencySeconds > 0 && (
                          <span className="text-base font-semibold text-white">
                            {formatLatency(result.LatencySeconds)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        {result.NodeName && (
                          <FieldRow label="Node Name" value={result.NodeName} />
                        )}
                        {result.IP && (
                          <FieldRow label="IP" value={result.IP} valueClassName="text-white font-mono" />
                        )}
                        {result.NodeIP && (
                          <FieldRow label="Node IP" value={result.NodeIP} valueClassName="text-white font-mono" />
                        )}
                        {result.Endpoint && (
                          <FieldRow label="Endpoint" value={result.Endpoint} valueClassName="text-white font-mono" />
                        )}
                        {result.PeerRelay && (
                          <FieldRow label="Peer Relay" value={result.PeerRelay} valueClassName="text-white font-mono" />
                        )}
                        {result.DERPRegionCode && (
                          <FieldRow label="DERP Region" value={result.DERPRegionCode} />
                        )}
                        {result.DERPRegionID !== undefined && result.DERPRegionID > 0 && (
                          <FieldRow label="DERP Region ID" value={result.DERPRegionID} />
                        )}
                        {result.PeerAPIURL && (
                          <FieldRow label="Peer API URL" value={result.PeerAPIURL} valueClassName="text-white font-mono" />
                        )}
                        {result.PeerAPIPort !== undefined && result.PeerAPIPort > 0 && (
                          <FieldRow label="Peer API Port" value={result.PeerAPIPort} valueClassName="text-white font-mono" />
                        )}
                        <FieldRow label="Is Local IP" value={<StatusBadge value={result.IsLocalIP} />} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// Query DNS Results Component
const QueryDNSResultsContent = ({ data }: { data: any }) => {
  const getResponseCodeColor = (rcode: string) => {
    if (rcode === 'NOERROR' || rcode === 'Success' || rcode.includes('Success')) return 'bg-green-600';
    if (rcode === 'NXDOMAIN') return 'bg-orange-600';
    return 'bg-red-600';
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        {/* Error Display */}
        {data.error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded">
            <h5 className="text-red-400 font-semibold text-base mb-1">Error</h5>
            <p className="text-red-300 text-sm">{data.error}</p>
          </div>
        )}

        {/* DNS Header */}
        {data.header && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h5 className="text-white font-semibold text-lg">DNS Query Result</h5>
              {data.header.responseCode && (
                <span className={`px-3 py-1 rounded text-sm font-medium text-white ${getResponseCodeColor(data.header.responseCode)}`}>
                  {data.header.responseCode}
                </span>
              )}
            </div>

            {/* Query Details */}
            <div className="grid grid-cols-2 gap-3">
              {data.header.name && (
                <FieldRow label="Name" value={data.header.name} valueClassName="text-white font-medium break-all" />
              )}
              {data.header.type && (
                <FieldRow label="Type" value={data.header.type} />
              )}
              {data.header.class && (
                <FieldRow label="Class" value={data.header.class} />
              )}
              {data.header.ttl !== undefined && (
                <FieldRow label="TTL" value={`${data.header.ttl}s`} />
              )}
            </div>

            {/* Responses */}
            {data.responses && data.responses.length > 0 && (
              <div>
                <h6 className="text-gray-400 text-sm mb-2">Responses</h6>
                <div className="space-y-1">
                  {data.responses.map((response: string, idx: number) => (
                    <div key={idx} className="bg-gray-800 px-3 py-2 rounded border border-gray-700">
                      <p className="text-white font-mono text-sm break-all">{response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolvers */}
            {data.resolvers && data.resolvers.length > 0 && (
              <ListSection label="Resolvers" items={data.resolvers} itemClassName="text-white font-mono text-sm" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Pprof Results Component - uses the PprofViewer for all types
const PprofResultsContent = ({ data }: { data: any }) => {
  return <PprofViewer data={data} />;
};

// Prefs Results Component
const PrefsResultsContent = ({ data }: { data: any }) => {
  // Handle top-level error for the host
  if (data.error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
        <p className="text-red-300">{data.error}</p>
      </div>
    );
  }

  // Helper for aligned table rows
  const TableRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <tr className="text-base">
      <td className="text-gray-400 pr-4 py-1 whitespace-nowrap align-middle">{label}</td>
      <td className="text-white font-medium py-1 align-middle">{children}</td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <h4 className="text-white font-semibold text-xl mb-4">Preferences</h4>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
          <table className="border-separate border-spacing-0">
            <tbody>
              {data.Hostname && (
                <TableRow label="Hostname">{data.Hostname}</TableRow>
              )}
              <TableRow label="Want Running"><StatusBadge value={data.WantRunning} /></TableRow>
              <TableRow label="Logged Out"><StatusBadge value={data.LoggedOut} trueColor="bg-red-600" /></TableRow>
              <TableRow label="Route All"><StatusBadge value={data.RouteAll} /></TableRow>
              <TableRow label="Corp DNS"><StatusBadge value={data.CorpDNS} /></TableRow>
              <TableRow label="Run SSH"><StatusBadge value={data.RunSSH} /></TableRow>
              <TableRow label="Run Web Client"><StatusBadge value={data.RunWebClient} /></TableRow>
              <TableRow label="Shields Up"><StatusBadge value={data.ShieldsUp} /></TableRow>
            </tbody>
          </table>

          <table className="border-separate border-spacing-0">
            <tbody>
              <TableRow label="No SNAT"><StatusBadge value={data.NoSNAT} /></TableRow>
              <TableRow label="No Stateful Filtering"><StatusBadge value={data.NoStatefulFiltering} /></TableRow>
              {data.NetfilterMode !== undefined && (
                <TableRow label="Netfilter Mode">{data.NetfilterMode}</TableRow>
              )}
              <TableRow label="Exit Node Allow LAN"><StatusBadge value={data.ExitNodeAllowLANAccess} /></TableRow>
              {data.ExitNodeID && (
                <TableRow label="Exit Node ID"><span className="font-mono truncate">{data.ExitNodeID}</span></TableRow>
              )}
              {data.OperatorUser && (
                <TableRow label="Operator User">{data.OperatorUser}</TableRow>
              )}
              {data.AutoUpdate && (
                <TableRow label="Auto Update Check"><StatusBadge value={data.AutoUpdate.Check} /></TableRow>
              )}
              {data.AppConnector && (
                <TableRow label="App Connector"><StatusBadge value={data.AppConnector.Advertise} trueLabel="Advertising" falseLabel="Not Advertising" /></TableRow>
              )}
            </tbody>
          </table>
        </div>

        {/* Control URL - full width */}
        {data.ControlURL && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <span className="text-gray-400 text-base">Control URL</span>
            <p className="text-white font-medium font-mono text-base break-all mt-1">{data.ControlURL}</p>
          </div>
        )}

        {/* Node ID - full width */}
        {data.Persist?.NodeID && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <span className="text-gray-400 text-base">Node ID</span>
            <p className="text-white font-mono text-base break-all mt-1">{data.Persist.NodeID}</p>
          </div>
        )}

        {/* Advertise Routes */}
        {data.AdvertiseRoutes && data.AdvertiseRoutes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <ListSection label="Advertise Routes" items={data.AdvertiseRoutes} itemClassName="text-white font-mono" />
          </div>
        )}

        {/* Advertise Tags */}
        {data.AdvertiseTags && data.AdvertiseTags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <TagBadges tags={data.AdvertiseTags} />
          </div>
        )}

        {/* User Profile */}
        {data.Persist?.UserProfile && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h5 className="text-gray-400 text-base mb-2">User Profile</h5>
            <div className="flex items-center gap-3">
              {data.Persist.UserProfile.ProfilePicURL && (
                <img
                  src={data.Persist.UserProfile.ProfilePicURL}
                  alt={data.Persist.UserProfile.DisplayName}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <p className="text-white font-medium text-lg">{data.Persist.UserProfile.DisplayName}</p>
                <p className="text-gray-400 text-base">{data.Persist.UserProfile.LoginName}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Drive Shares Results Component
const DriveSharesResultsContent = ({ data }: { data: any }) => {
  const shares = data.Shares || [];

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <h4 className="text-white font-semibold text-xl mb-4">
          Drive Shares {shares.length > 0 && <span className="text-gray-400 font-normal">({shares.length})</span>}
        </h4>

        {data.error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded">
            <p className="text-red-300 text-sm">{data.error}</p>
          </div>
        )}

        {shares.length === 0 && !data.error ? (
          <p className="text-gray-500 text-base">No drive shares configured on this host.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shares.map((share: any, idx: number) => (
              <div key={idx} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <h5 className="text-white font-semibold text-lg truncate">{share.Name || 'Unnamed Share'}</h5>
                </div>
                <div className="space-y-2">
                  {share.Path && (
                    <div>
                      <span className="text-gray-400 text-sm">Path</span>
                      <p className="text-white font-mono text-sm break-all">{share.Path}</p>
                    </div>
                  )}
                  {share.Who && (
                    <div>
                      <span className="text-gray-400 text-sm">Run As</span>
                      <p className="text-white text-sm">{share.Who}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// DNS Config Results Component
const DNSConfigResultsContent = ({ data }: { data: any }) => {
  // Data is passed directly (not wrapped in config)
  const hasNameservers = data.Nameservers && data.Nameservers.length > 0;
  const hasSearchDomains = data.SearchDomains && data.SearchDomains.length > 0;
  const hasMatchDomains = data.MatchDomains && data.MatchDomains.length > 0;
  const hasAnyConfig = hasNameservers || hasSearchDomains || hasMatchDomains;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <h4 className="text-white font-semibold text-xl mb-4">DNS Configuration</h4>

        {data.error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded">
            <p className="text-red-300 text-base">{data.error}</p>
          </div>
        )}

        {!hasAnyConfig && !data.error ? (
          <p className="text-gray-500 text-base">No DNS configuration available for this host.</p>
        ) : (
          <div className="space-y-6">
            {/* Nameservers */}
            {hasNameservers && (
              <div>
                <h5 className="text-gray-400 text-base mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                  Nameservers
                </h5>
                <div className="flex flex-wrap gap-2">
                  {data.Nameservers.map((ns: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-base font-mono">
                      {ns}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Search Domains */}
            {hasSearchDomains && (
              <div>
                <h5 className="text-gray-400 text-base mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search Domains
                </h5>
                <div className="flex flex-wrap gap-2">
                  {data.SearchDomains.map((domain: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-base font-mono">
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Match Domains */}
            {hasMatchDomains && (
              <div>
                <h5 className="text-gray-400 text-base mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Match Domains
                </h5>
                <div className="flex flex-wrap gap-2">
                  {data.MatchDomains.map((domain: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-base font-mono">
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Serve Config Results Component
const ServeConfigResultsContent = ({ data }: { data: any }) => {
  // Data is passed directly (not wrapped in config)
  const hasTCP = data.TCP && Object.keys(data.TCP).length > 0;
  const hasWeb = data.Web && Object.keys(data.Web).length > 0;
  const hasServices = data.Services && Object.keys(data.Services).length > 0;
  const hasFunnel = data.AllowFunnel && Object.keys(data.AllowFunnel).length > 0;
  const hasForeground = data.Foreground && Object.keys(data.Foreground).length > 0;
  const hasAnyConfig = hasTCP || hasWeb || hasServices || hasFunnel || hasForeground;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <div className="flex justify-between items-start mb-4">
          <h4 className="text-white font-semibold text-xl">Serve Configuration</h4>
          {data.ETag && (
            <span className="text-gray-500 text-sm font-mono" title="Configuration ETag">
              ETag: {data.ETag.substring(0, 16)}...
            </span>
          )}
        </div>

        {data.error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded">
            <p className="text-red-300 text-base">{data.error}</p>
          </div>
        )}

        {!hasAnyConfig && !data.error ? (
          <p className="text-gray-500 text-base">No serve configuration on this host.</p>
        ) : (
          <div className="space-y-6">
            {/* TCP Handlers */}
            {hasTCP && (
              <div>
                <h5 className="text-gray-400 text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  TCP Handlers
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(data.TCP).map(([port, handler]: [string, any]) => (
                    <div key={port} className="bg-gray-800 rounded-lg border border-gray-700 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 bg-blue-600 text-white rounded text-base font-mono">:{port}</span>
                        {handler.HTTPS && <span className="px-2 py-1 bg-green-600 text-white rounded text-sm">HTTPS</span>}
                        {handler.HTTP && <span className="px-2 py-1 bg-yellow-600 text-white rounded text-sm">HTTP</span>}
                      </div>
                      {handler.TCPForward && (
                        <p className="text-gray-300 text-base">Forward: <span className="font-mono">{handler.TCPForward}</span></p>
                      )}
                      {handler.TerminateTLS && (
                        <p className="text-gray-300 text-base">TLS: <span className="font-mono">{handler.TerminateTLS}</span></p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Web Handlers */}
            {hasWeb && (
              <div>
                <h5 className="text-gray-400 text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Web Handlers
                </h5>
                <div className="space-y-3">
                  {Object.entries(data.Web).map(([hostPort, webConfig]: [string, any]) => (
                    <div key={hostPort} className="bg-gray-800 rounded-lg border border-gray-700 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 bg-purple-600 text-white rounded text-base font-mono">{hostPort}</span>
                      </div>
                      {webConfig.Handlers && Object.entries(webConfig.Handlers).map(([mount, handler]: [string, any]) => (
                        <div key={mount} className="ml-2 mt-2 p-2 bg-gray-900 rounded border border-gray-700">
                          <span className="text-white font-mono text-base">{mount}</span>
                          {handler.Proxy && (
                            <p className="text-gray-400 text-base mt-1">Proxy: <span className="text-gray-300 font-mono">{handler.Proxy}</span></p>
                          )}
                          {handler.Path && (
                            <p className="text-gray-400 text-base mt-1">Path: <span className="text-gray-300 font-mono">{handler.Path}</span></p>
                          )}
                          {handler.Text && (
                            <p className="text-gray-400 text-base mt-1">Text: <span className="text-gray-300">{handler.Text}</span></p>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Services */}
            {hasServices && (
              <div>
                <h5 className="text-gray-400 text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Services
                </h5>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(data.Services).map((svc: string) => (
                    <span key={svc} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-base font-mono">
                      {svc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Funnel */}
            {hasFunnel && (
              <div>
                <h5 className="text-gray-400 text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Funnel Enabled
                </h5>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.AllowFunnel).filter(([_, enabled]) => enabled).map(([hostPort]: [string, any]) => (
                    <span key={hostPort} className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-base font-mono">
                      {hostPort}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Foreground Sessions */}
            {hasForeground && (
              <div>
                <h5 className="text-gray-400 text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Foreground Sessions ({Object.keys(data.Foreground).length})
                </h5>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(data.Foreground).map((sessionId: string) => (
                    <span key={sessionId} className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-base font-mono truncate max-w-xs">
                      {sessionId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// AppConn Routes Results Component
const AppConnRoutesResultsContent = ({ data }: { data: any }) => {
  // Data is passed directly (not wrapped in routeInfo)
  const hasControl = data.Control && data.Control.length > 0;
  const hasDomains = data.Domains && Object.keys(data.Domains).length > 0;
  const hasWildcards = data.Wildcards && data.Wildcards.length > 0;
  const hasAnyRoutes = hasControl || hasDomains || hasWildcards;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <h4 className="text-white font-semibold text-xl mb-4">App Connector Routes</h4>

        {data.error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded">
            <p className="text-red-300 text-base">{data.error}</p>
          </div>
        )}

        {!hasAnyRoutes && !data.error ? (
          <p className="text-gray-500 text-base">No app connector routes configured on this host.</p>
        ) : (
          <div className="space-y-6">
            {/* Control Routes */}
            {hasControl && (
              <div>
                <h5 className="text-gray-400 text-base mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Control Routes (ACL)
                </h5>
                <div className="flex flex-wrap gap-2">
                  {data.Control.map((prefix: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-base font-mono">
                      {prefix}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Wildcards */}
            {hasWildcards && (
              <div>
                <h5 className="text-gray-400 text-base mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Wildcard Domains
                </h5>
                <div className="flex flex-wrap gap-2">
                  {data.Wildcards.map((wildcard: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-base font-mono">
                      {wildcard}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Discovered Domains */}
            {hasDomains && (
              <div>
                <h5 className="text-gray-400 text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Discovered Domains ({Object.keys(data.Domains).length})
                </h5>
                <div className="space-y-2">
                  {Object.entries(data.Domains).map(([domain, addrs]: [string, any]) => (
                    <div key={domain} className="bg-gray-800 rounded-lg border border-gray-700 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-mono text-base font-medium">{domain}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(addrs as string[]).map((addr: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-1 bg-green-600 text-white rounded text-sm font-mono">
                            {addr}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Goroutines Results Component
interface ParsedGoroutine {
  id: string;
  state: string;
  duration?: string;
  stack: string;
}

const parseGoroutines = (stackTrace: string): ParsedGoroutine[] => {
  // Split by "goroutine " but keep the delimiter
  const parts = stackTrace.split(/(?=^goroutine \d+)/m).filter(part => part.trim());

  return parts.map(part => {
    // Parse the header line: "goroutine 6290 [running]:" or "goroutine 1 [IO wait, 3 minutes]:"
    const headerMatch = part.match(/^goroutine (\d+) \[([^\]]+)\]:/);
    if (!headerMatch) {
      return { id: '?', state: 'unknown', stack: part.trim() };
    }

    const id = headerMatch[1];
    const stateInfo = headerMatch[2];

    // Check if there's a duration in the state (e.g., "IO wait, 3 minutes")
    const durationMatch = stateInfo.match(/^(.+?),\s*(.+)$/);
    const state = durationMatch ? durationMatch[1] : stateInfo;
    const duration = durationMatch ? durationMatch[2] : undefined;

    // Get the stack trace (everything after the header line)
    const stackLines = part.split('\n').slice(1).join('\n').trim();

    return { id, state, duration, stack: stackLines };
  });
};

const getStateColor = (state: string): string => {
  const stateLower = state.toLowerCase();
  if (stateLower === 'running') return 'bg-green-600';
  if (stateLower.includes('wait') || stateLower.includes('receive') || stateLower.includes('select')) return 'bg-blue-600';
  if (stateLower.includes('sleep')) return 'bg-yellow-600';
  if (stateLower.includes('syscall')) return 'bg-purple-600';
  if (stateLower.includes('chan')) return 'bg-cyan-600';
  if (stateLower.includes('sync')) return 'bg-orange-600';
  return 'bg-gray-600';
};

const GoroutinesResultsContent = ({ data }: { data: any }) => {
  // Handle error case
  if (data?.error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
        <p className="text-red-300">{data.error}</p>
      </div>
    );
  }

  // Data is already a string (the stack trace)
  const stackTrace = typeof data === 'string' ? data : '';

  if (!stackTrace) {
    return <p className="text-gray-500">No goroutine data available.</p>;
  }

  const goroutines = parseGoroutines(stackTrace);

  // Helper to format a single goroutine as text for copying
  const formatGoroutineText = (g: ParsedGoroutine): string => {
    const header = g.duration
      ? `goroutine ${g.id} [${g.state}, ${g.duration}]:`
      : `goroutine ${g.id} [${g.state}]:`;
    return `${header}\n${g.stack}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-white font-semibold text-xl">
          Goroutines <span className="text-gray-400 font-normal">({goroutines.length})</span>
        </h4>
        <button
          onClick={() => navigator.clipboard.writeText(stackTrace)}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded border border-gray-600 transition-colors flex items-center gap-1.5"
          title="Copy all goroutines"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2H10a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy All
        </button>
      </div>
      <div className="space-y-3">
        {goroutines.map((g, idx) => (
          <div key={idx} className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 border-b border-gray-700">
              <span className="text-white font-mono font-semibold text-lg">#{g.id}</span>
              <span className={`px-3 py-1 rounded text-sm font-medium text-white ${getStateColor(g.state)}`}>
                {g.state}
              </span>
              {g.duration && (
                <span className="text-gray-400 text-base">{g.duration}</span>
              )}
              <button
                onClick={() => navigator.clipboard.writeText(formatGoroutineText(g))}
                className="ml-auto px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-sm rounded border border-gray-600 transition-colors flex items-center gap-1.5"
                title="Copy this goroutine"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2H10a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
            {/* Stack trace */}
            <div className="p-3 overflow-x-auto">
              <GoStackTraceSyntaxHighlighter stackTrace={g.stack} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Generic Stream Results Component (for Logs and Debug Events)
interface StreamResultsContentProps {
  streamData: Record<string, string>;
  selectedOutputHost: string;
  isStreaming: boolean;
  streamEndRef: RefObject<HTMLDivElement | null>;
  title: string;
}

const StreamResultsContent = ({ streamData, selectedOutputHost, isStreaming, streamEndRef, title }: StreamResultsContentProps) => {
  const waitingMessage = title === 'Logs' ? 'Waiting for logs...' : 'Waiting for bus events...';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-white font-semibold text-xl">{title}</h4>
        {isStreaming && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-base">Streaming...</span>
          </div>
        )}
      </div>
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <div className="relative">
          <CopyButton text={streamData[selectedOutputHost] || ''} />
          <div className="bg-black rounded border border-gray-700 p-4 max-h-[600px] overflow-y-auto">
            <pre className="text-gray-300 text-base font-mono whitespace-pre-wrap break-all">
              {streamData[selectedOutputHost] || waitingMessage}
              <div ref={streamEndRef} />
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

// Status Results Component
const StatusResultsContent = ({ data }: { data: any }) => {
  // Handle top-level error for the host
  if (data.error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
        <p className="text-red-300">{data.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <h4 className="text-white font-semibold text-xl mb-4">Overview</h4>
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Version" value={data.Version || 'N/A'} />
          <FieldRow label="Backend State" value={
            <span className="text-white font-medium flex items-center">
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${data.BackendState === 'Running' ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {data.BackendState || 'Unknown'}
            </span>
          } />
          <FieldRow label="TUN" value={<StatusBadge value={data.TUN} trueLabel="Enabled" falseLabel="Disabled" />} />
          <FieldRow label="Tailnet" value={data.CurrentTailnet?.Name || 'N/A'} />
          <FieldRow label="MagicDNS" value={<StatusBadge value={data.CurrentTailnet?.MagicDNSEnabled} trueLabel="Enabled" falseLabel="Disabled" />} />
          <FieldRow label="MagicDNS Suffix" value={data.MagicDNSSuffix || 'N/A'} valueClassName="text-white font-mono" />
          {data.CertDomains && data.CertDomains.length > 0 && (
            <div className="col-span-2">
              <ListSection label="Cert Domains" items={data.CertDomains} itemClassName="text-white font-mono" />
            </div>
          )}
        </div>

        {/* Health Warnings */}
        {data.Health && data.Health.length > 0 && (
          <div className="mt-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
            <h5 className="text-yellow-400 font-semibold text-lg mb-2">Health Warnings</h5>
            <ul className="space-y-1">
              {data.Health.map((warning: string, idx: number) => (
                <li key={idx} className="text-yellow-300 text-base">• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* This Node Info */}
        {data.Self && (
          <>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Hostname" value={data.Self.HostName} />
                <FieldRow label="DNS Name" value={data.Self.DNSName} />
                <FieldRow label="OS" value={data.Self.OS} />
                <FieldRow label="Status" value={<StatusBadge value={data.Self.Online} trueLabel="Online" falseLabel="Offline" trueColor="bg-green-600" falseColor="bg-red-600" />} />
                {data.Self.Relay && (
                  <FieldRow label="DERP Relay" value={data.Self.Relay} />
                )}
                {data.Self.ID && (
                  <FieldRow label="Node ID" value={data.Self.ID} valueClassName="text-white font-mono" />
                )}
              </div>

              {data.Self.TailscaleIPs && data.Self.TailscaleIPs.length > 0 && (
                <div className="mt-3">
                  <ListSection
                    label="Tailscale IPs"
                    items={data.Self.TailscaleIPs}
                    itemClassName="text-white font-medium font-mono"
                  />
                </div>
              )}

              {data.Self.Tags && data.Self.Tags.length > 0 && (
                <div className="mt-3">
                  <TagBadges tags={data.Self.Tags} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-700">
                <FieldRow label="Data Sent" value={formatBytes(data.Self.TxBytes || 0)} />
                <FieldRow label="Data Received" value={formatBytes(data.Self.RxBytes || 0)} />
                <FieldRow label="Created" value={formatTimestamp(data.Self.Created)} />
                <FieldRow label="Last Write" value={formatTimestamp(data.Self.LastWrite)} />
              </div>

              {(data.Self.ExitNode || data.Self.ExitNodeOption) && (
                <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
                  {data.Self.ExitNode && <StatusBadge value={true} trueLabel="Exit Node" trueColor="bg-green-600" />}
                  {data.Self.ExitNodeOption && <StatusBadge value={true} trueLabel="Exit Node Option" trueColor="bg-blue-600" />}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Users */}
      {data.User && Object.keys(data.User).length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <h4 className="text-white font-semibold text-xl mb-4">
            Users ({Object.keys(data.User).length})
          </h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(data.User).map(([userId, user]: [string, any]) => (
              <div key={userId} className="bg-gray-800 rounded p-3 border border-gray-700 flex items-center gap-3">
                {user.ProfilePicURL && (
                  <img
                    src={user.ProfilePicURL}
                    alt={user.DisplayName}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="text-white font-medium text-lg">{user.DisplayName}</p>
                  <p className="text-gray-400 text-base">{user.LoginName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peers */}
      {data.Peer && Object.keys(data.Peer).length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <h4 className="text-white font-semibold text-xl mb-4">
            Peers ({Object.keys(data.Peer).length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {Object.entries(data.Peer).map(([key, peer]: [string, any]) => (
              <div key={key} className="bg-gray-800 rounded p-3 border border-gray-700">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-white font-semibold text-lg">{peer.HostName}</p>
                    <p className="text-gray-400 text-base">{peer.DNSName}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <StatusBadge value={peer.Online} trueLabel="Online" falseLabel="Offline" trueColor="bg-green-600" falseColor="bg-gray-600" />
                    {peer.Active && <StatusBadge value={true} trueLabel="Active" trueColor="bg-blue-600" />}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <FieldRow label="OS" value={peer.OS} />
                  {peer.Relay && <FieldRow label="Relay" value={peer.Relay} />}
                  {peer.CurAddr && <FieldRow label="Direct" value={peer.CurAddr} />}
                  <FieldRow label="Last Seen" value={formatTimestamp(peer.LastSeen)} />
                  {peer.LastHandshake && peer.LastHandshake !== '0001-01-01T00:00:00Z' && (
                    <FieldRow label="Handshake" value={formatTimestamp(peer.LastHandshake)} />
                  )}
                  <FieldRow label="TX" value={formatBytes(peer.TxBytes || 0)} />
                  <FieldRow label="RX" value={formatBytes(peer.RxBytes || 0)} />
                  {peer.KeyExpiry && (
                    <FieldRow label="Key Expiry" value={formatTimestamp(peer.KeyExpiry)} />
                  )}
                </div>
                {peer.TailscaleIPs && peer.TailscaleIPs.length > 0 && (
                  <div className="mt-2">
                    <ListSection
                      label="IPs"
                      items={peer.TailscaleIPs}
                      itemClassName="text-white font-medium font-mono"
                    />
                  </div>
                )}
                {peer.Tags && peer.Tags.length > 0 && (
                  <div className="mt-2">
                    <TagBadges tags={peer.Tags} />
                  </div>
                )}
                {peer.PrimaryRoutes && peer.PrimaryRoutes.length > 0 && (
                  <div className="mt-2">
                    <ListSection
                      label="Routes"
                      items={peer.PrimaryRoutes}
                      itemClassName="text-white font-medium font-mono"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
