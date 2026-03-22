// Segmented button group — inline styles so Tailwind purging can't remove dynamic bg
export default function SegmentGroup({ options, value, onChange, labelFn }) {
  return (
    <div style={{ display: 'flex', borderRadius: '0.5rem', border: '1px solid #475569', overflow: 'hidden' }}>
      {options.map(opt => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              flex: 1,
              padding: '0.625rem 0',
              fontSize: '0.875rem',
              fontWeight: selected ? 600 : 400,
              cursor: 'pointer',
              border: 'none',
              outline: 'none',
              color: selected ? '#ffffff' : '#94a3b8',
              backgroundColor: selected ? '#d97706' : '#1e293b',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {labelFn ? labelFn(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}
