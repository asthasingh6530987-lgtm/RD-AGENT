import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { motion, AnimatePresence } from 'motion/react';
import 'react-day-picker/style.css';

interface CustomCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  highlightedDates: string[]; // Array of YYYY-MM-DD
  onViewMonthChange?: (month: Date) => void;
}

export default function CustomCalendar({ selectedDate, onSelectDate, highlightedDates, onViewMonthChange }: CustomCalendarProps) {
  const parseDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState<Date>(parseDate(selectedDate));
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update displayMonth when selectedDate changes from outside
  useEffect(() => {
    setDisplayMonth(parseDate(selectedDate));
  }, [selectedDate]);

  const displayDate = parseDate(selectedDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const highlightedDatesObjects = highlightedDates.map(parseDate);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center gap-4 bg-white p-2.5 pr-6 rounded-2xl border-2 transition-all shadow-premium hover-lift ${
          isOpen ? 'border-brand ring-4 ring-brand/10' : 'border-slate-100 hover:border-brand/20'
        }`}
      >
        <div className={`p-2.5 rounded-xl transition-all shadow-inner-light ${
          isOpen ? 'bg-brand text-white scale-110' : 'bg-brand/10 text-brand group-hover:bg-brand/20'
        }`}>
          <CalendarIcon className="w-5 h-5" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Select Date</span>
          <span className="text-slate-900 font-black uppercase tracking-tight text-sm">{displayDate}</span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="calendar-popover"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute top-full right-0 mt-4 bg-white rounded-[2.5rem] shadow-premium border border-brand/10 p-6 z-[100] min-w-[320px] overflow-hidden"
          >
            {/* Background Accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gold/5 rounded-full -ml-16 -mb-16 blur-3xl"></div>

            <style>{`
              .rdp-root {
                --rdp-accent-color: #dc2626;
                --rdp-background-color: #fef2f2;
                --rdp-accent-color-foreground: #ffffff;
                --rdp-day-font-weight: 700;
                --rdp-day_button-border-radius: 12px;
                margin: 0;
                font-family: inherit;
              }
              .rdp-day_button {
                transition: all 0.2s ease;
                font-size: 0.875rem;
                text-transform: uppercase;
                letter-spacing: 0.025em;
              }
              .rdp-day_button:hover:not(.rdp-selected) {
                background-color: #fef2f2 !important;
                color: #dc2626 !important;
                transform: scale(1.1);
              }
              .rdp-selected .rdp-day_button {
                background-color: #dc2626 !important;
                color: #ffffff !important;
                box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.3);
              }
              .rdp-caption_label {
                font-weight: 900 !important;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #0f172a;
                font-size: 0.875rem;
              }
              .rdp-weekday {
                font-size: 0.7rem;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #94a3b8;
                padding-bottom: 1rem;
              }
              .rdp-day_highlighted:not(.rdp-selected) .rdp-day_button {
                color: #dc2626;
                background-color: #fef2f2;
                position: relative;
              }
              .rdp-day_highlighted:not(.rdp-selected) .rdp-day_button::after {
                content: '';
                position: absolute;
                bottom: 4px;
                left: 50%;
                transform: translateX(-50%);
                width: 4px;
                height: 4px;
                background-color: #dc2626;
                border-radius: 50%;
              }
              
              /* Fix for DayPicker Dropdowns */
              .rdp-dropdown {
                position: relative !important;
                opacity: 1 !important;
                appearance: auto !important;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                padding: 4px 20px 4px 8px;
                font-size: 0.875rem;
                font-weight: 600;
                color: #0f172a;
                background-color: white;
                cursor: pointer;
                margin: 0 4px;
                height: 32px;
                pointer-events: auto !important;
                z-index: 10;
                min-width: max-content;
              }
              .rdp-dropdown:hover {
                border-color: #dc2626;
              }
              .rdp-dropdown:focus {
                outline: none;
                border-color: #dc2626;
                box-shadow: 0 0 0 1px #dc2626;
              }
              .rdp-caption_label {
                display: none !important;
              }
              .rdp-dropdown_root {
                display: flex !important;
                align-items: center;
                pointer-events: auto !important;
              }
              .rdp-dropdowns {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-bottom: 12px;
                justify-content: center;
                pointer-events: auto !important;
              }
              .rdp-month_caption {
                justify-content: center;
                pointer-events: auto !important;
              }
              .rdp-dropdown_icon {
                display: none !important;
              }
              .rdp-chevron {
                display: none !important; 
              }
              /* EXCEPT ensure nav buttons still have a chevron */
              .rdp-nav .rdp-chevron {
                display: inline-block !important;
              }
            `}</style>
            <DayPicker
              mode="single"
              selected={parseDate(selectedDate)}
              month={displayMonth}
              onMonthChange={(date) => {
                setDisplayMonth(date);
                if (onViewMonthChange) onViewMonthChange(date);
              }}
              onSelect={(date) => {
                if (date) {
                  onSelectDate(formatDate(date));
                  setIsOpen(false);
                }
              }}
              captionLayout="dropdown"
              startMonth={new Date(2020, 0)}
              endMonth={new Date(2035, 11)}
              modifiers={{
                highlighted: highlightedDatesObjects
              }}
              modifiersClassNames={{
                highlighted: 'rdp-day_highlighted'
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
