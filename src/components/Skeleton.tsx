import React from 'react';

const Bone: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div className="skeleton" style={style} />
);

export const SkeletonStatCard: React.FC = () => (
  <div
    className="glass-panel"
    style={{
      padding: 'var(--space-6)',
      borderRadius: 'var(--radius-xl)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
      <Bone style={{ width: '110px', height: '14px' }} />
      <Bone style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-lg)', flexShrink: 0 }} />
    </div>
    <Bone style={{ width: '80px', height: '30px', marginBottom: 'var(--space-2)' }} />
    <Bone style={{ width: '150px', height: '12px' }} />
  </div>
);

const TABLE_DATA_COLS = 10;

export const SkeletonTableRows: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <>
    {Array.from({ length: rows }, (_, i) => (
      <tr key={i}>
        <td
          style={{
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--glass-border)',
            position: 'sticky',
            left: 0,
            backgroundColor: 'var(--bg-elevated)',
            borderRight: '1px solid var(--glass-border)',
            boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
          }}
        >
          <Bone style={{ width: '56px', height: '14px' }} />
        </td>
        {Array.from({ length: TABLE_DATA_COLS }, (_, j) => (
          <td key={j} style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--glass-border)', textAlign: 'right' as const }}>
            <Bone style={{ width: '52px', height: '14px', marginLeft: 'auto' }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const SkeletonChart: React.FC<{ height?: number }> = ({ height = 400 }) => (
  <div
    className="glass-panel"
    style={{
      padding: 'var(--space-6)',
      borderRadius: 'var(--radius-xl)',
      height: `${height}px`,
      overflow: 'hidden',
    }}
  >
    <Bone style={{ width: '180px', height: '16px', marginBottom: 'var(--space-4)' }} />
    <Bone style={{ width: '100%', height: `${height - 72}px`, borderRadius: 'var(--radius-md)' }} />
  </div>
);

export const SkeletonTrendCard: React.FC = () => (
  <div
    className="glass-panel"
    style={{
      padding: 'var(--space-6)',
      borderRadius: 'var(--radius-xl)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-5)' }}>
      <Bone style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-lg)', flexShrink: 0 }} />
      <Bone style={{ width: '130px', height: '18px' }} />
    </div>
    <Bone style={{ width: '100%', height: '320px', borderRadius: 'var(--radius-md)' }} />
  </div>
);
