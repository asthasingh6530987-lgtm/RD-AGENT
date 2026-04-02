import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { motion, AnimatePresence } from 'motion/react';
import 'react-day-picker/style.css';

interface CustomCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  highlightedDates: string[]; // Array of YYYY-MM-DD
}

export default function CustomCalendar({ selectedDate, onSelectDate, highlightedDates }: CustomCalendarProps) {
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
            `}</style>
            <DayPicker
              mode="single"
              selected={parseDate(selectedDate)}
              onSelect={(date) => {
                if (date) {
                  onSelectDate(formatDate(date));
                  setIsOpen(false);
                }
              }}
              modifiers={{
                highlighted: highlightedDatesObjects
              }}
              modifiersClassNames={{
                highlighted: 'rdp-day_highlighted'
              }}
              onMonthChange={(month) => {
                onSelectDate(formatDate(new Date(month.getFullYear(), month.getMonth(), 1)));
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
