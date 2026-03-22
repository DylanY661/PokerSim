// Simple toggle using inline styles to avoid Tailwind purge issues
export default function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        outline: 'none',
        padding: 0,
        cursor: 'pointer',
        flexShrink: 0,
        backgroundColor: value ? '#f59e0b' : '#475569',
        transition: 'background-color 0.2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: value ? '22px' : '2px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}
