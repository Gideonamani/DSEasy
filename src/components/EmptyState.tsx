import React from 'react';
import { Coffee, Info, CalendarX2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-12) var(--space-6)',
    textAlign: 'center',
    minHeight: '400px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--glass-border)',
    marginTop: 'var(--space-6)'
  }}>
    <div style={{
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'rgba(99, 102, 241, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 'var(--space-6)'
    }}>
      <Icon size={40} color="var(--accent-primary)" strokeWidth={1.5} />
    </div>
    <h2 style={{
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-semibold)',
      color: 'var(--text-primary)',
      marginBottom: 'var(--space-3)'
    }}>
      {title}
    </h2>
    <p style={{
      fontSize: 'var(--text-base)',
      color: 'var(--text-secondary)',
      maxWidth: '460px',
      lineHeight: 1.6
    }}>
      {description}
    </p>
  </div>
);

interface MarketEmptyStateProps {
  selectedDate: string | null;
  availableDates: { sheetName: string; date: Date | null }[];
}

export const MarketEmptyState: React.FC<MarketEmptyStateProps> = ({ 
  selectedDate, 
  availableDates 
}) => {
  const [, setSearchParams] = useSearchParams();

  // If no date is selected, we shouldn't show this state (or it's an initialization error)
  if (!selectedDate) return null;

  // Determine the day of the week
  const dateObj = new Date(selectedDate);
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6; // 0 is Sunday, 6 is Saturday

  // Find the most recent available date
  const latestAvailableDate = availableDates.length > 0 ? availableDates[0].sheetName : null;

  // Find the exact closest previous date
  const closestPreviousDate = availableDates.find(d => {
    if (!d.date) return false;
    return d.date < dateObj;
  })?.sheetName;

  const handleGoToLatest = () => {
    if (latestAvailableDate) {
      setSearchParams({ date: latestAvailableDate });
    }
  };

  const handleGoToPrevious = () => {
    if (closestPreviousDate) {
      setSearchParams({ date: closestPreviousDate });
    }
  };

  return (
    <div className="empty-state-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-12) var(--space-6)',
      textAlign: 'center',
      minHeight: '400px',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--glass-border)',
      marginTop: 'var(--space-6)'
    }}>
      
      {/* Icon Area */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: isWeekend ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 'var(--space-6)'
      }}>
        {isWeekend ? (
          <Coffee size={40} color="var(--accent-primary)" strokeWidth={1.5} />
        ) : (
          <CalendarX2 size={40} color="var(--accent-danger)" strokeWidth={1.5} />
        )}
      </div>

      {/* Text Content */}
      <h2 style={{
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--font-semibold)',
        color: 'var(--text-primary)',
        marginBottom: 'var(--space-3)'
      }}>
        {isWeekend ? 'No Trading on Weekends' : 'No Market Data Found'}
      </h2>
      
      <p style={{
        fontSize: 'var(--text-base)',
        color: 'var(--text-secondary)',
        maxWidth: '460px',
        marginBottom: 'var(--space-8)',
        lineHeight: 1.6
      }}>
        {isWeekend 
          ? `The Dar es Salaam Stock Exchange is closed on Saturdays and Sundays. There is no trading activity recorded for ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(dateObj)}.`
          : `We couldn't find any trading data for ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(dateObj)}. This usually happens on public holidays or days with zero market activity.`
        }
      </p>

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {closestPreviousDate && (
          <button 
            onClick={handleGoToPrevious}
            className="btn-secondary"
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)',
              cursor: 'pointer',
              fontWeight: 'var(--font-medium)',
              transition: 'background 0.2s'
            }}
          >
            Go to Previous Trading Day
          </button>
        )}
        
        {latestAvailableDate && latestAvailableDate !== closestPreviousDate && (
          <button 
            onClick={handleGoToLatest}
            className="btn-primary"
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'var(--font-medium)',
              boxShadow: '0 4px 6px rgba(99, 102, 241, 0.2)',
              transition: 'transform 0.1s, background 0.2s'
            }}
          >
            Go to Latest Available Date
          </button>
        )}
      </div>

      {/* Info Note for Holidays */}
      {!isWeekend && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-8)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'rgba(234, 179, 8, 0.1)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)'
        }}>
          <Info size={16} color="var(--accent-warning)" />
          <span>If you believe data should exist for this date, please check back later or verify your data source.</span>
        </div>
      )}

      <style>{`
        .btn-secondary:hover {
          background: var(--bg-hover) !important;
        }
        .btn-primary:active {
          transform: scale(0.98);
        }
        .btn-primary:hover {
          background: #4f46e5 !important;
        }
      `}</style>
    </div>
  );
};
