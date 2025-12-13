import React from 'react';

// Helper functions for formatting
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatTimestamp = (timestamp: string): string => {
  if (!timestamp || timestamp === '0001-01-01T00:00:00Z') return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  }
  return date.toLocaleDateString();
};

export const formatTimestampLocal = (timestamp: string): string => {
  if (!timestamp || timestamp === '0001-01-01T00:00:00Z') return 'Never';
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
};

export const formatLatency = (seconds: number): string => {
  if (seconds === 0) return 'N/A';
  const ms = seconds * 1000;
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}µs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
};

// Reusable status badge component
export const StatusBadge = ({ value, trueColor = 'bg-green-600', falseColor = 'bg-gray-600', trueLabel = 'Yes', falseLabel = 'No' }: {
  value: boolean;
  trueColor?: string;
  falseColor?: string;
  trueLabel?: string;
  falseLabel?: string;
}) => (
  <span className={`px-2.5 py-1 rounded text-sm font-medium text-white ${value ? trueColor : falseColor}`}>
    {value ? trueLabel : falseLabel}
  </span>
);

// Reusable field row component
export const FieldRow = ({ label, value, valueClassName = 'text-white font-medium' }: {
  label: string;
  value: string | React.ReactNode;
  valueClassName?: string;
}) => (
  <div className="flex items-start gap-2 text-base">
    <span className="text-gray-400 shrink-0">{label}:</span>
    {typeof value === 'string' ? (
      <span className={valueClassName}>{value}</span>
    ) : (
      value
    )}
  </div>
);

// Reusable list section component
export const ListSection = ({ label, items, itemClassName = 'text-white font-medium' }: {
  label: string;
  items: string[];
  itemClassName?: string;
}) => (
  <div className="text-base">
    <div className="text-gray-400 mb-1.5">{label}:</div>
    <div className="ml-4 flex flex-wrap gap-2">
      {items.map((item: string, idx: number) => (
        <div key={idx} className={`${itemClassName} bg-gray-700 px-2.5 py-1 rounded`}>{item}</div>
      ))}
    </div>
  </div>
);

// Reusable tag badges component
export const TagBadges = ({ tags }: { tags: string[] }) => (
  <div>
    <div className="text-gray-400 mb-1">Tags:</div>
    <div className="ml-4 flex flex-wrap gap-1">
      {tags.map((tag: string) => (
        <span key={tag} className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-medium">{tag}</span>
      ))}
    </div>
  </div>
);

// Collapsible Section Header component
export const CollapsibleSectionHeader = ({ title, isCollapsed, onToggle }: {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
}) => (
  <div
    className="px-3 py-2 bg-gray-800/30 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
    onClick={onToggle}
  >
    <span className="text-white font-medium text-sm">{title}</span>
    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </div>
);

// Alert Box component
export const AlertBox = ({ type, children, className = '' }: {
  type: 'error' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}) => {
  const styles = {
    error: 'bg-red-900/20 border-red-700/50 text-red-400',
    warning: 'bg-yellow-900/20 border-yellow-700/50 text-yellow-400',
    info: 'bg-blue-900/20 border-blue-700/50 text-blue-400'
  };
  return (
    <div className={`p-3 border rounded ${styles[type]} ${className}`}>
      {children}
    </div>
  );
};

// Keyboard Key component
export const KeyboardKey = ({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) => (
  <kbd className={`px-2 py-1 bg-gray-700 rounded text-gray-300 font-mono ${wide ? '' : 'min-w-[24px] text-center'}`}>
    {children}
  </kbd>
);

// Control Legend Item component
export const ControlLegendItem = ({ keys, label }: { keys: string[]; label?: string }) => (
  <div className="flex items-center gap-2.5">
    {keys.map((key, idx) => <KeyboardKey key={idx} wide={key.length > 1}>{key}</KeyboardKey>)}
    {label && <span className="text-gray-300">{label}</span>}
  </div>
);

// Command Button component
export const CommandButton = ({ onClick, disabled, children }: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-base font-medium transition-colors"
  >
    {children}
  </button>
);

// Toggle Switch component
export const ToggleSwitch = ({ checked, onChange, label }: {
  checked: boolean;
  onChange: () => void;
  label?: string;
}) => (
  <div className="flex items-center gap-2">
    {label && <span className="text-gray-400 text-base">{label}</span>}
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-gray-600'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

// Copy to Clipboard Button Component
export const CopyButton = ({ text, showLabel = true }: { text: string; showLabel?: boolean }) => (
  <button
    onClick={() => navigator.clipboard.writeText(text)}
    className="absolute top-2 right-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded border border-gray-600 transition-colors flex items-center gap-1.5"
    title="Copy to clipboard"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
    {showLabel && 'Copy'}
  </button>
);

// JSON Syntax Highlighter Component
export const JsonSyntaxHighlighter = ({ data }: { data: any }) => {
  const syntaxHighlight = (json: string): string => {
    // Escape HTML
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Apply syntax highlighting with HTML spans
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'text-blue-400'; // numbers
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-cyan-400'; // keys
          match = match.slice(0, -1); // Remove the colon for highlighting
          return `<span class="${cls}">${match}</span><span class="text-gray-300">:</span>`;
        } else {
          cls = 'text-green-400'; // strings
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-yellow-400'; // booleans
      } else if (/null/.test(match)) {
        cls = 'text-purple-400'; // null
      }
      return `<span class="${cls}">${match}</span>`;
    });
  };

  const jsonString = JSON.stringify(data, null, 2);
  const highlighted = syntaxHighlight(jsonString);

  return (
    <pre
      className="text-sm font-mono overflow-x-auto bg-gray-950 p-4 rounded text-gray-300"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
};

// Go Stack Trace Syntax Highlighter Component
export const GoStackTraceSyntaxHighlighter = ({ stackTrace }: { stackTrace: string }) => {
  const highlightStackTrace = (text: string): string => {
    // Escape HTML first
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Process line by line for better control
    return text.split('\n').map(line => {
      // Function calls - lines starting with package/function path
      // e.g., "runtime.gopark(0xc0001a2000, 0xc0001a4000, 0x12, 0x1)"
      if (/^[a-zA-Z0-9_./]+\.[a-zA-Z0-9_]+\(/.test(line)) {
        // Highlight function name and arguments separately
        return line.replace(
          /^([a-zA-Z0-9_./]+)\.([a-zA-Z0-9_]+)(\(.*\))$/,
          '<span class="text-gray-400">$1.</span><span class="text-yellow-400">$2</span><span class="text-gray-500">$3</span>'
        );
      }

      // File paths with line numbers - lines starting with whitespace then path
      // e.g., "	/usr/local/go/src/runtime/proc.go:398 +0xce"
      if (/^\t/.test(line)) {
        return line.replace(
          /^(\t)([^\s:]+):(\d+)(\s+\+0x[a-fA-F0-9]+)?$/,
          '$1<span class="text-cyan-400">$2</span>:<span class="text-blue-400">$3</span><span class="text-gray-500">$4</span>'
        );
      }

      // "created by" lines
      if (/^created by /.test(line)) {
        return line.replace(
          /^(created by )([a-zA-Z0-9_./]+)\.([a-zA-Z0-9_]+)( in goroutine \d+)?$/,
          '<span class="text-purple-400">$1</span><span class="text-gray-400">$2.</span><span class="text-yellow-400">$3</span><span class="text-gray-500">$4</span>'
        );
      }

      // Default - return as-is
      return `<span class="text-gray-300">${line}</span>`;
    }).join('\n');
  };

  const highlighted = highlightStackTrace(stackTrace);

  return (
    <pre
      className="text-base font-mono overflow-x-auto text-gray-300"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
};
