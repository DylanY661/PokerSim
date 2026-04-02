// Segmented button group — inline styles so Tailwind purging can't remove dynamic bg
export default function SegmentGroup({ options, value, onChange, labelFn }) {
  return (
    <div style={{ display: 'flex', borderRadius: '0.375rem', border: '1px solid #d4d4d8', overflow: 'hidden' }}>
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
              color: selected ? '#ffffff' : '#3f3f46',
              backgroundColor: selected ? '#065f46' : '#ffffff',
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
