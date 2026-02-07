import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export const CustomSelect = ({ value, options, onChange, placeholder = "Select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div 
      className="custom-select-container" 
      ref={containerRef}
      style={{ position: "relative", minWidth: "180px" }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--glass-border)",
          borderRadius: "var(--radius-lg)",
          color: "var(--text-primary)",
          cursor: "pointer",
          fontSize: "var(--text-sm)",
          transition: "all 0.2s",
          outline: "none"
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-strong)"}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--glass-border)"}
      >
        <span style={{ fontWeight: "var(--font-medium)" }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={16} 
          style={{ 
            color: "var(--text-secondary)", 
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", 
            transition: "transform 0.2s" 
          }} 
        />
      </button>

      {isOpen && (
        <div 
          className="glass-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            padding: "4px",
            boxShadow: "var(--shadow-lg)",
            maxHeight: "240px",
            overflowY: "auto"
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: option.value === value ? "var(--bg-hover)" : "transparent",
                border: "none",
                borderRadius: "var(--radius-md)",
                color: option.value === value ? "var(--accent-primary)" : "var(--text-primary)",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                textAlign: "left",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => {
                if (option.value !== value) {
                    e.currentTarget.style.background = "var(--bg-hover)";
                    e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                 if (option.value !== value) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-primary)";
                 }
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
