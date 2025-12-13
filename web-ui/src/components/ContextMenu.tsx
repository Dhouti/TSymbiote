import { useState } from 'react';
import {
  StatusBadge,
  FieldRow,
  ListSection,
  TagBadges,
  CollapsibleSectionHeader,
  formatBytes,
  formatTimestampLocal
} from './UIComponents';

// Node Context Menu Component
export const NodeContextMenu = ({ data, onClose, onFilterToHost }: { data: any; onClose: () => void; onFilterToHost?: () => void }) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(['identity', 'network', 'exitnode', 'tags', 'traffic', 'timestamps', 'additional'])
  );

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-96 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50 sticky top-0 z-10">
        <h4 className="text-white font-semibold text-base truncate min-w-0 flex-1">{data.label}</h4>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {onFilterToHost && (
            <button
              onClick={() => {
                onFilterToHost();
                onClose();
              }}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Filter To Host
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-800">
        {/* Status Section */}
        <div>
          <CollapsibleSectionHeader title="Status" isCollapsed={collapsedSections.has('status')} onToggle={() => toggleSection('status')} />
          {!collapsedSections.has('status') && (
            <div className="px-3 py-2 space-y-1.5 text-sm bg-gray-900/50">
              <FieldRow label="Online" value={<StatusBadge value={data.data.Online} trueColor="bg-green-600" falseColor="bg-red-600" />} />
              <FieldRow label="Active" value={<StatusBadge value={data.data.Active} />} />
              {data.data.hasSymbiote !== undefined && (
                <FieldRow label="Has Symbiote" value={<StatusBadge value={data.data.hasSymbiote} trueColor="bg-purple-600" />} />
              )}
            </div>
          )}
        </div>

        {/* Identity Section */}
        <div>
          <CollapsibleSectionHeader title="Identity" isCollapsed={collapsedSections.has('identity')} onToggle={() => toggleSection('identity')} />
          {!collapsedSections.has('identity') && (
            <div className="px-3 py-2 space-y-1.5 text-sm bg-gray-900/50">
              {data.data.HostName && <FieldRow label="Hostname" value={data.data.HostName} />}
              {data.data.DNSName && <FieldRow label="DNS Name" value={data.data.DNSName} valueClassName="text-white font-medium break-all" />}
              {data.data.OS && <FieldRow label="OS" value={data.data.OS} />}
              {data.data.UserID && <FieldRow label="User ID" value={data.data.UserID} valueClassName="text-white font-mono text-xs break-all" />}
              {data.data.ID && <FieldRow label="ID" value={data.data.ID} valueClassName="text-white font-mono text-xs break-all" />}
              {data.data.PublicKey && (
                <div>
                  <div className="text-gray-400 mb-1">Public Key:</div>
                  <div className="text-white font-mono text-xs break-all bg-gray-950/50 px-2 py-1 rounded">{data.data.PublicKey}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Network Section */}
        <div>
          <CollapsibleSectionHeader title="Network" isCollapsed={collapsedSections.has('network')} onToggle={() => toggleSection('network')} />
          {!collapsedSections.has('network') && (
            <div className="px-3 py-2 space-y-1.5 text-sm bg-gray-900/50">
              {data.data.TailscaleIPs && data.data.TailscaleIPs.length > 0 && (
                <ListSection label="Tailscale IPs" items={data.data.TailscaleIPs} itemClassName="text-white font-medium font-mono text-sm" />
              )}
              {data.data.AllowedIPs && data.data.AllowedIPs.length > 0 && (
                <ListSection label="Allowed IPs" items={data.data.AllowedIPs} itemClassName="text-white font-medium font-mono text-sm" />
              )}
              {data.data.Addrs && data.data.Addrs.length > 0 && (
                <ListSection label="Addresses" items={data.data.Addrs} itemClassName="text-white font-medium font-mono text-sm" />
              )}
              {data.data.CurAddr && <FieldRow label="Current Address" value={data.data.CurAddr} valueClassName="text-white font-mono text-xs break-all" />}
              {data.data.Relay && <FieldRow label="Relay" value={data.data.Relay} />}
              {data.data.PeerRelay && <FieldRow label="Peer Relay" value={data.data.PeerRelay} />}
            </div>
          )}
        </div>

        {/* Exit Node Section */}
        {(data.data.ExitNode || data.data.ExitNodeOption) && (
          <div>
            <CollapsibleSectionHeader title="Exit Node" isCollapsed={collapsedSections.has('exitnode')} onToggle={() => toggleSection('exitnode')} />
            {!collapsedSections.has('exitnode') && (
              <div className="px-3 py-2 space-y-1.5 text-sm bg-gray-900/50">
                <FieldRow label="Exit Node" value={<StatusBadge value={data.data.ExitNode} />} />
                <FieldRow label="Exit Node Option" value={<StatusBadge value={data.data.ExitNodeOption} />} />
              </div>
            )}
          </div>
        )}

        {/* Tags & Routes Section */}
        {((data.data.Tags && data.data.Tags.length > 0) || (data.data.PrimaryRoutes && data.data.PrimaryRoutes.length > 0)) && (
          <div>
            <CollapsibleSectionHeader title="Tags & Routes" isCollapsed={collapsedSections.has('tags')} onToggle={() => toggleSection('tags')} />
            {!collapsedSections.has('tags') && (
              <div className="px-3 py-2 space-y-1.5 text-sm bg-gray-900/50">
                {data.data.Tags && data.data.Tags.length > 0 && <TagBadges tags={data.data.Tags} />}
                {data.data.PrimaryRoutes && data.data.PrimaryRoutes.length > 0 && (
                  <ListSection label="Primary Routes" items={data.data.PrimaryRoutes} itemClassName="text-white font-medium font-mono text-sm" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Traffic Section */}
        {(data.data.RxBytes !== undefined || data.data.TxBytes !== undefined) && (
          <div>
            <CollapsibleSectionHeader title="Traffic" isCollapsed={collapsedSections.has('traffic')} onToggle={() => toggleSection('traffic')} />
            {!collapsedSections.has('traffic') && (
              <div className="px-3 py-2 space-y-1.5 text-sm bg-gray-900/50">
                {data.data.RxBytes !== undefined && <FieldRow label="Received" value={formatBytes(data.data.RxBytes)} />}
                {data.data.TxBytes !== undefined && <FieldRow label="Sent" value={formatBytes(data.data.TxBytes)} />}
              </div>
            )}
          </div>
        )}

        {/* Timestamps Section */}
        <div>
          <CollapsibleSectionHeader title="Timestamps" isCollapsed={collapsedSections.has('timestamps')} onToggle={() => toggleSection('timestamps')} />
          {!collapsedSections.has('timestamps') && (
            <div className="px-3 py-2 space-y-1.5 text-sm bg-gray-900/50">
              {data.data.Created && <FieldRow label="Created" value={formatTimestampLocal(data.data.Created)} valueClassName="text-white font-medium text-xs" />}
              {data.data.LastWrite && <FieldRow label="Last Write" value={formatTimestampLocal(data.data.LastWrite)} valueClassName="text-white font-medium text-xs" />}
              {data.data.LastSeen && <FieldRow label="Last Seen" value={formatTimestampLocal(data.data.LastSeen)} valueClassName="text-white font-medium text-xs" />}
              {data.data.LastHandshake && <FieldRow label="Last Handshake" value={formatTimestampLocal(data.data.LastHandshake)} valueClassName="text-white font-medium text-xs" />}
              {data.data.KeyExpiry && <FieldRow label="Key Expiry" value={formatTimestampLocal(data.data.KeyExpiry)} valueClassName="text-white font-medium text-xs" />}
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div>
          <CollapsibleSectionHeader title="Additional" isCollapsed={collapsedSections.has('additional')} onToggle={() => toggleSection('additional')} />
          {!collapsedSections.has('additional') && (
            <div className="px-3 py-2 space-y-1.5 text-sm bg-gray-900/50">
              {data.data.PeerAPIURL && data.data.PeerAPIURL.length > 0 && (
                <ListSection label="Peer API URLs" items={data.data.PeerAPIURL} itemClassName="text-white font-medium font-mono text-sm break-all" />
              )}
              {data.data.Capabilities && data.data.Capabilities.length > 0 && (
                <ListSection label="Capabilities" items={data.data.Capabilities} />
              )}
              {data.data.CapMap && Object.keys(data.data.CapMap).length > 0 && (
                <ListSection label="Capability Map" items={Object.keys(data.data.CapMap)} />
              )}
              <FieldRow label="In Network Map" value={<StatusBadge value={data.data.InNetworkMap} />} />
              <FieldRow label="In Magic Sock" value={<StatusBadge value={data.data.InMagicSock} />} />
              <FieldRow label="In Engine" value={<StatusBadge value={data.data.InEngine} />} />
              {data.data.TaildropTarget !== undefined && <FieldRow label="Taildrop Target" value={data.data.TaildropTarget} />}
              {data.data.NoFileSharingReason && <FieldRow label="No File Sharing Reason" value={data.data.NoFileSharingReason} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
