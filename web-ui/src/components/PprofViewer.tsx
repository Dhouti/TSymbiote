import { useState, useEffect } from 'react';
import { formatBytes } from './UIComponents';

interface PprofViewerProps {
  data: any;
}

// Get a friendly name for the pprof type
const getTypeLabel = (pprofType: string): string => {
  const typeLabels: Record<string, string> = {
    profile: 'CPU Profile',
    heap: 'Heap Profile',
    allocs: 'Allocations Profile',
    goroutine: 'Goroutine Profile',
    block: 'Block Profile',
    mutex: 'Mutex Profile',
    threadcreate: 'Thread Create Profile',
    trace: 'Trace',
    cmdline: 'Command Line',
  };
  return typeLabels[pprofType] || `Pprof - ${pprofType}`;
};

// Get file extension for the pprof type
const getFileExtension = (pprofType: string): string => {
  if (pprofType === 'trace') {
    return 'trace';
  }
  return 'pprof';
};

// Pprof Component - Download pprof files
export const PprofViewer = ({ data }: PprofViewerProps) => {
  const [profileUrl, setProfileUrl] = useState<string>('');

  const hostName = data.host || data.hostname || 'unknown';
  const pprofType = data.pprofType || 'profile';
  const fileSize = data.data?.byteLength ? formatBytes(data.data.byteLength) : '';
  const typeLabel = getTypeLabel(pprofType);
  const fileExtension = getFileExtension(pprofType);

  // Create blob URL for download
  useEffect(() => {
    if (!data || data.error || !data.data) return;

    const blob = new Blob([data.data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    setProfileUrl(url);

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [data]);

  if (data?.error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/50 rounded">
        <h5 className="text-red-400 font-semibold text-base mb-1">Error</h5>
        <p className="text-red-300 text-sm">{data.error}</p>
      </div>
    );
  }

  if (!data || !data.data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h4 className="text-white font-semibold text-xl mb-4">{hostName} - {typeLabel}</h4>

        <div className="space-y-4">
          <p className="text-gray-300 text-base">
            Profile data collected successfully. Download the file to analyze with your preferred tool.
          </p>

          <div>
            <a
              href={profileUrl}
              download={`${hostName}-${pprofType}.${fileExtension}`}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded text-white text-base font-medium transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <span className="text-gray-500 text-base">Example:</span>
            <code className="text-gray-300 text-lg bg-gray-800 px-4 py-2 rounded font-mono">
              go tool pprof -http=:8000 {hostName}-{pprofType}.{fileExtension}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(`go tool pprof -http=:8000 ${hostName}-${pprofType}.${fileExtension}`)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
              title="Copy command"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          <div className="text-gray-400 text-sm mt-4">
            {hostName}-{pprofType}.{fileExtension} {fileSize && `(${fileSize})`}
          </div>
        </div>
      </div>
    </div>
  );
};
