import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export const StatCard = ({ title, value, change, subtext, type = 'neutral' }) => {
  const isPositive = type === 'success' || (parseFloat(change) > 0 && type !== 'danger');
  const isNegative = type === 'danger' || (parseFloat(change) < 0 && type !== 'success');

  let accentColor = 'var(--text-secondary)';
  if (isPositive) accentColor = 'var(--accent-success)';
  if (isNegative) accentColor = 'var(--accent-danger)';
  if (type === 'primary') accentColor = 'var(--accent-primary)';

  return (
    <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
        {/* Background Glow */}
        <div style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '100px',
            height: '100px',
            background: accentColor,
            filter: 'blur(50px)',
            opacity: 0.15,
            borderRadius: '50%'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>{title}</span>
            <div style={{ 
                padding: '8px', 
                borderRadius: '12px', 
                background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
                color: accentColor
            }}>
                {isPositive ? <ArrowUpRight size={20} /> : isNegative ? <ArrowDownRight size={20} /> : <Activity size={20} />}
            </div>
        </div>

        <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
            {value}
        </div>

        {(change || subtext) && (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                {!!change && (
                    <span style={{ 
                        color: accentColor, 
                        fontWeight: 600, 
                        marginRight: '8px',
                        display: 'flex', 
                        alignItems: 'center'
                    }}>
                        {change > 0 ? '+' : ''}{change}%
                    </span>
                )}
                <span style={{ color: 'var(--text-secondary)' }}>{subtext || 'vs last close'}</span>
            </div>
        )}
    </div>
  );
};
