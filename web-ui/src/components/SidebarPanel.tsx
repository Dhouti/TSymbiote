import { FormInput, CheckboxListItem, CommandButton } from './';

interface SidebarPanelProps {
  // Sidebar state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Hosts
  hosts: string[];
  selectedHosts: Set<string>;
  toggleHost: (hostId: string) => void;
  toggleAllHosts: () => void;
  hostSearchFilter: string;
  setHostSearchFilter: (filter: string) => void;
  filteredHostsForDisplay: string[];

  // Peers/Targets
  selectedTargets: Set<string>;
  toggleTarget: (targetId: string) => void;
  toggleAllTargets: () => void;
  targetSearchFilter: string;
  setTargetSearchFilter: (filter: string) => void;
  filteredTargetsForDisplay: string[];
  reachableTargets: string[];
  hideOfflinePeers: boolean;
  setHideOfflinePeers: (hide: boolean) => void;

  // Commands
  fetchStatus: () => void;
  fetchPrefs: () => void;
  fetchDriveShares: () => void;
  fetchDNSConfig: () => void;
  fetchServeConfig: () => void;
  fetchAppConnRoutes: () => void;
  fetchGoroutines: () => void;
  fetchLogs: () => void;
  fetchBusEvents: () => void;
  openQueryDNSModal: () => void;
  openPprofModal: () => void;
  statusLoading: boolean;
  isStreaming: boolean;
}

export const SidebarPanel = ({
  sidebarOpen,
  setSidebarOpen,
  hosts,
  selectedHosts,
  toggleHost,
  toggleAllHosts,
  hostSearchFilter,
  setHostSearchFilter,
  filteredHostsForDisplay,
  selectedTargets,
  toggleTarget,
  toggleAllTargets,
  targetSearchFilter,
  setTargetSearchFilter,
  filteredTargetsForDisplay,
  reachableTargets,
  hideOfflinePeers,
  setHideOfflinePeers,
  fetchStatus,
  fetchPrefs,
  fetchDriveShares,
  fetchDNSConfig,
  fetchServeConfig,
  fetchAppConnRoutes,
  fetchGoroutines,
  fetchLogs,
  fetchBusEvents,
  openQueryDNSModal,
  openPprofModal,
  statusLoading,
  isStreaming,
}: SidebarPanelProps) => {
  return (
    <div
      className={`fixed left-0 top-0 h-screen bg-gray-800 border-r border-gray-700 transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-120' : 'w-12'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute -right-3 top-4 bg-gray-700 hover:bg-gray-600 rounded-full p-1 border border-gray-600"
      >
        <svg
          className={`w-4 h-4 text-white transition-transform ${sidebarOpen ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {sidebarOpen && (
        <div className="flex flex-col h-full">
          {/* TSymbiote Logo */}
          <div className="p-8 border-b border-gray-700">
            <h1 className="text-7xl font-bold text-white text-center">TSymbiote</h1>
          </div>

          <div className="flex flex-1">
            {/* Left Column: Hosts and Peers */}
            <div className="flex-[3] max-w-[75%] min-w-0 border-r border-gray-700 flex flex-col">
              {/* Hosts Section */}
              <div className="flex-1 p-6 border-b border-gray-700 flex flex-col min-h-0">
                <h3 className="text-white font-semibold text-2xl mb-6">
                  Hosts ({selectedHosts.size}/{hosts.length})
                </h3>

                {/* Search Input */}
                <div className="mb-4">
                  <FormInput
                    value={hostSearchFilter}
                    onChange={(e) => setHostSearchFilter(e.target.value)}
                    placeholder="Search hosts..."
                    focusColor="green"
                  />
                </div>

                {/* Select All / Deselect All */}
                <div className="mb-4">
                  <button
                    onClick={toggleAllHosts}
                    className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded text-white text-base transition-colors"
                  >
                    {selectedHosts.size === hosts.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Host List */}
                <div className="space-y-1 overflow-y-auto pr-2 flex-1">
                  {filteredHostsForDisplay.map((hostId) => (
                    <CheckboxListItem
                      key={hostId}
                      label={hostId}
                      checked={selectedHosts.has(hostId)}
                      onChange={() => toggleHost(hostId)}
                      checkColor="green"
                      size="lg"
                    />
                  ))}
                </div>
              </div>

              {/* Peers Section */}
              <div className="flex-1 p-6 flex flex-col min-h-0">
                <h3 className="text-white font-semibold text-2xl mb-6">
                  Peers ({selectedTargets.size}/{reachableTargets.length})
                </h3>

                {/* Hide Offline Checkbox */}
                <div className="mb-4">
                  <CheckboxListItem
                    label="Hide Offline"
                    checked={hideOfflinePeers}
                    onChange={() => setHideOfflinePeers(!hideOfflinePeers)}
                    checkColor="blue"
                  />
                </div>

                {/* Search Input */}
                <div className="mb-4">
                  <FormInput
                    value={targetSearchFilter}
                    onChange={(e) => setTargetSearchFilter(e.target.value)}
                    placeholder="Search peers..."
                    focusColor="blue"
                  />
                </div>

                {/* Select All / Deselect All Peers */}
                <div className="mb-4">
                  <button
                    onClick={toggleAllTargets}
                    disabled={reachableTargets.length === 0}
                    className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-base transition-colors"
                  >
                    {selectedTargets.size === reachableTargets.length ? 'Deselect All Peers' : 'Select All Peers'}
                  </button>
                </div>

                {/* Target List */}
                <div className="space-y-1 overflow-y-auto pr-2 flex-1">
                  {filteredTargetsForDisplay.length > 0 ? (
                    filteredTargetsForDisplay.map((targetId) => (
                      <CheckboxListItem
                        key={targetId}
                        label={targetId}
                        checked={selectedTargets.has(targetId)}
                        onChange={() => toggleTarget(targetId)}
                        checkColor="blue"
                        size="lg"
                      />
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No target nodes available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Commands */}
            <div className="flex-1 min-w-0 p-6 flex flex-col items-center">
              <h3 className="text-white font-semibold text-2xl mb-6">Commands</h3>
              <div className="w-full space-y-3">
                <CommandButton onClick={fetchStatus} disabled={selectedHosts.size === 0 || statusLoading}>
                  {statusLoading ? 'Loading...' : 'Status'}
                </CommandButton>
                <CommandButton onClick={openQueryDNSModal} disabled={selectedHosts.size === 0 || statusLoading}>
                  Query DNS
                </CommandButton>
                <CommandButton onClick={openPprofModal} disabled={selectedHosts.size === 0 || statusLoading}>
                  Pprof
                </CommandButton>
                <CommandButton onClick={fetchPrefs} disabled={selectedHosts.size === 0 || statusLoading}>
                  Prefs
                </CommandButton>
                <CommandButton onClick={fetchDriveShares} disabled={selectedHosts.size === 0 || statusLoading}>
                  Drive Shares
                </CommandButton>
                <CommandButton onClick={fetchDNSConfig} disabled={selectedHosts.size === 0 || statusLoading}>
                  DNS Config
                </CommandButton>
                <CommandButton onClick={fetchServeConfig} disabled={selectedHosts.size === 0 || statusLoading}>
                  Serve Config
                </CommandButton>
                <CommandButton onClick={fetchAppConnRoutes} disabled={selectedHosts.size === 0 || statusLoading}>
                  AppConn Routes
                </CommandButton>
                <CommandButton onClick={fetchGoroutines} disabled={selectedHosts.size === 0 || statusLoading}>
                  Goroutines
                </CommandButton>
                <CommandButton onClick={fetchLogs} disabled={selectedHosts.size === 0 || isStreaming}>
                  Logs
                </CommandButton>
                <CommandButton onClick={fetchBusEvents} disabled={selectedHosts.size === 0 || isStreaming}>
                  Bus Events
                </CommandButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
