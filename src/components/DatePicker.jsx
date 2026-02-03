import { createPortal } from "react-dom";
import ReactDatePicker from "react-datepicker";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";

export const DatePicker = ({ 
  selectedDate, 
  availableDates, 
  loadingData, 
  onChange
}) => {
  // Derive date object directly from props
  const currentDate = (() => {
    if (selectedDate && availableDates.length > 0) {
      const found = availableDates.find(d => d.sheetName === selectedDate);
      if (found && found.date) {
        return new Date(found.date);
      }
    }
    return null;
  })();

  // Helper: Find index of current selection
  const currentIndex = availableDates.findIndex(d => d.sheetName === selectedDate);

  const handlePrev = () => {
    if (currentIndex < availableDates.length - 1) {
      onChange(availableDates[currentIndex + 1].sheetName);
    }
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      onChange(availableDates[currentIndex - 1].sheetName);
    }
  };

  const handleCalendarChange = (date) => {
    if (!date) return;
    // Find matching sheet for this date
    // We compare ISO strings YYYY-MM-DD to be safe or just time value (ignoring time)
    // Actually, the includesDates ensures we only pick valid ones.
    const found = availableDates.find(d => {
       if (!d.date) return false;
       const dDate = new Date(d.date);
       return dDate.getDate() === date.getDate() && 
              dDate.getMonth() === date.getMonth() && 
              dDate.getFullYear() === date.getFullYear();
    });

    if (found) {
      onChange(found.sheetName);
    }
  };

  // Extract enabled dates for the calendar
  const includeDates = availableDates
    .filter(d => d.date)
    .map(d => new Date(d.date));

  // Ensure z-index is higher than everything else (Sidebar is 60, Header is 50)
  const POFFER_Z_INDEX = { zIndex: 99999, position: 'relative' };

  return (
    <div className="glass-panel" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '4px 8px', 
      borderRadius: '8px',
      gap: '8px',
      background: 'var(--bg-elevated)' // Use elevated background for the bar itself (solid)
    }}>
      
      <button 
        onClick={handlePrev} 
        disabled={currentIndex >= availableDates.length - 1 || loadingData}
        className="icon-btn"
        style={{ opacity: (currentIndex >= availableDates.length - 1 || loadingData) ? 0.3 : 1 }}
      >
        <ChevronLeft size={18} />
      </button>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <CalendarIcon size={16} style={{ position: 'absolute', left: '8px', zIndex: 1, pointerEvents: 'none', color: 'var(--text-secondary)' }} />
        <ReactDatePicker
          selected={currentDate}
          onChange={handleCalendarChange}
          includeDates={includeDates}
          dateFormat="dd MMM yyyy"
          className="date-picker-input"
          placeholderText={loadingData ? "Loading..." : "Select Date"}
          disabled={loadingData}
          popperPlacement="bottom-end"
          popperContainer={({ children }) => createPortal(
            <div style={POFFER_Z_INDEX}>{children}</div>,
            document.body
          )}
        />
      </div>

      <button 
        onClick={handleNext} 
        disabled={currentIndex <= 0 || loadingData}
        className="icon-btn"
        style={{ opacity: (currentIndex <= 0 || loadingData) ? 0.3 : 1 }}
      >
        <ChevronRight size={18} />
      </button>

      {loadingData && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}

      <style>{`
        .date-picker-input {
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          padding: 6px 12px 6px 32px;
          color: var(--text-primary);
          font-family: inherit;
          font-size: 14px;
          width: 140px;
          cursor: pointer;
          outline: none;
        }
        .date-picker-input:hover {
          background: var(--bg-hover);
        }
        .react-datepicker {
          background-color: var(--bg-elevated) !important;
          border: 1px solid var(--border-subtle) !important;
          font-family: inherit !important;
          color: var(--text-primary) !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        .react-datepicker__header {
          background-color: var(--bg-elevated) !important;
          border-bottom: 1px solid var(--border-subtle) !important;
        }
        .react-datepicker__month-container {
           background-color: var(--bg-elevated) !important;
        }
        .react-datepicker__current-month, .react-datepicker__day-name {
          color: var(--text-primary) !important;
        }
        .react-datepicker__day {
          color: var(--text-secondary) !important;
        }
        .react-datepicker__day:hover {
          background-color: var(--accent-primary) !important;
          color: white !important;
        }
        .react-datepicker__day--selected {
          background-color: var(--accent-primary) !important;
          color: white !important;
          font-weight: bold;
        }
        .react-datepicker__day--disabled {
          color: var(--text-secondary) !important;
          opacity: 0.3;
        }
        .icon-btn {
          background: transparent;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-btn:hover:not(:disabled) {
          background: var(--bg-hover);
        }
        .react-datepicker-popper {
          z-index: 99999 !important;
        }
      `}</style>
    </div>
  );
};
