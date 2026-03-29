import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
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
        className="flex items-center gap-3 bg-white p-2 pr-4 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
      >
        <div className="p-2 bg-red-50 text-red-600 rounded-lg">
          <CalendarIcon className="w-5 h-5" />
        </div>
        <span className="text-gray-700 font-medium">{displayDate}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
          <style>{`
            .rdp-root {
              --rdp-accent-color: #dc2626; /* red-600 */
              --rdp-background-color: #fef2f2; /* red-50 */
              margin: 0;
            }
            .rdp-day_highlighted:not(.rdp-selected) {
              font-weight: bold;
              color: #dc2626;
              background-color: #fef2f2;
              border-radius: 100%;
            }
            .rdp-day_highlighted:not(.rdp-selected)::after {
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
              // Optionally trigger data fetch for the new month by selecting the 1st
              onSelectDate(formatDate(new Date(month.getFullYear(), month.getMonth(), 1)));
            }}
          />
        </div>
      )}
    </div>
  );
}
