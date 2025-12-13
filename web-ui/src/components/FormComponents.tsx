// Focus color class mappings (Tailwind requires static class names)
const focusBorderClasses = {
  purple: 'focus:border-purple-500',
  green: 'focus:border-green-500',
  blue: 'focus:border-blue-500',
} as const;

const checkColorClasses = {
  purple: 'text-purple-500 focus:ring-purple-500',
  green: 'text-green-500 focus:ring-green-500',
  blue: 'text-blue-500 focus:ring-blue-500',
} as const;

// Form Input component
export const FormInput = ({ value, onChange, placeholder, type = 'text', autoFocus, focusColor = 'purple', min, max, className = '' }: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  focusColor?: 'purple' | 'green' | 'blue';
  min?: number;
  max?: number;
  className?: string;
}) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    autoFocus={autoFocus}
    min={min}
    max={max}
    className={`w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 ${focusBorderClasses[focusColor]} focus:outline-none ${className}`}
  />
);

// Form Label component
export const FormLabel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <label className={`block text-gray-300 text-sm font-medium mb-2 ${className}`}>{children}</label>
);

// Form Select component
export const FormSelect = ({ value, onChange, options, focusColor = 'purple', className = '' }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  focusColor?: 'purple' | 'green' | 'blue';
  className?: string;
}) => (
  <select
    value={value}
    onChange={onChange}
    className={`w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 ${focusBorderClasses[focusColor]} focus:outline-none ${className}`}
  >
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

// Checkbox List Item component
export const CheckboxListItem = ({ label, checked, onChange, checkColor = 'green', truncate = true, size = 'md' }: {
  label: string;
  checked: boolean;
  onChange: () => void;
  checkColor?: 'green' | 'blue' | 'purple';
  truncate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-4 h-4', lg: 'w-5 h-5' };
  const textClasses = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };
  return (
    <label className="flex items-center space-x-3 p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={`${sizeClasses[size]} ${checkColorClasses[checkColor]} bg-gray-700 border-gray-600 rounded`}
      />
      <span className={`text-gray-300 ${textClasses[size]} ${truncate ? 'truncate' : ''}`} title={label}>{label}</span>
    </label>
  );
};

// Modal Action Buttons component
export const ModalActionButtons = ({ onCancel, onSubmit, cancelText = 'Cancel', submitText = 'Submit', submitDisabled = false }: {
  onCancel: () => void;
  onSubmit: () => void;
  cancelText?: string;
  submitText?: string;
  submitDisabled?: boolean;
}) => (
  <div className="flex gap-3 pt-4">
    <button
      onClick={onCancel}
      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white font-medium transition-colors"
    >
      {cancelText}
    </button>
    <button
      onClick={onSubmit}
      disabled={submitDisabled}
      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white font-medium transition-colors"
    >
      {submitText}
    </button>
  </div>
);
