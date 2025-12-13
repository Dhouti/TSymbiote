import React from 'react';

// Modal Component
interface ModalProps {
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  children: React.ReactNode;
}

export const Modal = ({ title, onClose, onSubmit, children }: ModalProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl w-96 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-semibold text-xl">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};
