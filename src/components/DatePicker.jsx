import { Calendar, Loader2 } from "lucide-react";

export const DatePicker = ({ 
  selectedDate, 
  availableDates, 
  loadingData, 
  onChange
}) => {
  return (
    <div className="glass-panel date-picker-container">
      <Calendar size={18} color="var(--text-secondary)" />
      <select
        value={selectedDate}
        onChange={(e) => onChange(e.target.value)}
        className="date-select"
        disabled={loadingData}
      >
        {availableDates.map((date) => (
          <option key={date} value={date} style={{ background: "#1e293b" }}>
            {date}
          </option>
        ))}
      </select>
      {loadingData && <Loader2 size={16} className="animate-spin" style={{marginLeft: 8}}/>}
    </div>
  );
};
