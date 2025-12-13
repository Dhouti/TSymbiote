import { LAYOUT_OPTIONS } from '../constants';
import { EDGE_COLORS } from '../utils';

interface GraphControlsProps {
  // Layout
  layoutType: string;
  setLayoutType: (type: string) => void;

  // Reset
  onReset: () => void;

  // Fit to view
  onFitToView: () => void;
}

export const GraphControls = ({
  layoutType,
  setLayoutType,
  onReset,
  onFitToView,
}: GraphControlsProps) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {/* Layout Selector */}
      <select
        value={layoutType}
        onChange={(e) => setLayoutType(e.target.value)}
        className="px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none text-base font-medium shadow-lg cursor-pointer"
      >
        {LAYOUT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-base font-medium transition-colors shadow-lg"
      >
        Reset
      </button>

      {/* Fit To View Button */}
      <button
        onClick={onFitToView}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-base font-medium transition-colors shadow-lg"
      >
        Fit To View
      </button>
    </div>
  );
};

interface PingControlsProps {
  // Ping action
  onPing: () => void;
  disabled: boolean;
  loading: boolean;

  // Settings
  showPingSettings: boolean;
  setShowPingSettings: (show: boolean) => void;
  pingCount: number;
  setPingCount: (count: number) => void;
  pingType: 'disco' | 'TSMP' | 'ICMP' | 'peerapi';
  setPingType: (type: 'disco' | 'TSMP' | 'ICMP' | 'peerapi') => void;
  pingDelay: number;
  setPingDelay: (delay: number) => void;
}

export const PingControls = ({
  onPing,
  disabled,
  loading,
  showPingSettings,
  setShowPingSettings,
  pingCount,
  setPingCount,
  pingType,
  setPingType,
  pingDelay,
  setPingDelay,
}: PingControlsProps) => {
  return (
    <div className="absolute top-4 left-4 z-50 flex flex-col gap-3">
      <div className="flex items-stretch w-full">
        <button
          onClick={onPing}
          disabled={disabled}
          className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-l-lg text-white text-base font-medium transition-colors shadow-lg"
        >
          {loading ? 'Loading...' : 'Ping'}
        </button>
        <button
          onClick={() => setShowPingSettings(!showPingSettings)}
          className="px-2 bg-purple-600 hover:bg-purple-500 rounded-r-lg text-white transition-colors shadow-lg border-l border-purple-700 flex items-center"
          title="Ping settings"
        >
          <svg className={`w-5 h-5 transition-transform ${showPingSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Ping Settings Dropdown */}
      {showPingSettings && (
        <div className="bg-gray-800 rounded-lg border border-gray-600 p-4 shadow-lg">
          <h4 className="text-white font-semibold text-sm mb-3">Ping Settings</h4>
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-sm block mb-1">Count</label>
              <input
                type="number"
                min="1"
                max="20"
                value={pingCount}
                onChange={(e) => setPingCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Type</label>
              <select
                value={pingType}
                onChange={(e) => setPingType(e.target.value as 'disco' | 'TSMP' | 'ICMP' | 'peerapi')}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="disco">Disco</option>
                <option value="TSMP">TSMP</option>
                <option value="ICMP">ICMP</option>
                <option value="peerapi">PeerAPI</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Delay (ms)</label>
              <input
                type="number"
                min="0"
                max="2000"
                step="50"
                value={pingDelay}
                onChange={(e) => setPingDelay(Math.min(2000, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <ConnectionLegend />
    </div>
  );
};

export const ConnectionLegend = () => {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-600 p-4 shadow-lg">
      <h4 className="text-white font-semibold text-sm mb-3">Connection Type</h4>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5" style={{ backgroundColor: EDGE_COLORS.DIRECT }}></div>
          <span className="text-gray-300 text-sm">Direct</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5" style={{ backgroundColor: EDGE_COLORS.PEER_API }}></div>
          <span className="text-gray-300 text-sm">Peer API</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5" style={{ backgroundColor: EDGE_COLORS.PEER_RELAY }}></div>
          <span className="text-gray-300 text-sm">Peer Relay</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5" style={{ backgroundColor: EDGE_COLORS.DERP }}></div>
          <span className="text-gray-300 text-sm">DERP</span>
        </div>
      </div>
    </div>
  );
};
