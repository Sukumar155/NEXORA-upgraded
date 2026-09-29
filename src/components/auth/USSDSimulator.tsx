import React, { useState } from 'react';
import { X, PhoneCall, RotateCcw, Delete, Radio, Signal, BatteryCharging } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';

export const USSDSimulator: React.FC = () => {
  const { isUSSDOpen, toggleUSSDModal, rainfallMmPerHour, riverLevelMeters } = useNexoraStore();
  const [dialedCode, setDialedCode] = useState<string>('*123#');
  const [currentStep, setCurrentStep] = useState<'IDLE' | 'MENU' | 'DANGER_COUNT' | 'STRANDED_TYPE' | 'SHELTER_LOC' | 'CONFIRMATION' | 'WEATHER'>('IDLE');
  const [inputBuffer, setInputBuffer] = useState<string>('');
  const [ticketNumber, setTicketNumber] = useState<string>('');

  if (!isUSSDOpen) return null;

  const handleKeyPress = (char: string) => {
    if (currentStep === 'IDLE') {
      setDialedCode(prev => prev + char);
    } else {
      setInputBuffer(prev => prev + char);
    }
  };

  const handleDelete = () => {
    if (currentStep === 'IDLE') {
      setDialedCode(prev => prev.slice(0, -1));
    } else {
      setInputBuffer(prev => prev.slice(0, -1));
    }
  };

  const handleCall = () => {
    if (currentStep === 'IDLE') {
      if (dialedCode.trim() === '*123#' || dialedCode.trim() === '*123') {
        setCurrentStep('MENU');
        setInputBuffer('');
      } else {
        alert("Enter *123# to access NEXORA USSD Gateway");
      }
    } else {
      handleSend();
    }
  };

  const handleSend = () => {
    const choice = inputBuffer.trim();
    if (currentStep === 'MENU') {
      if (choice === '1') {
        setCurrentStep('DANGER_COUNT');
        setInputBuffer('');
      } else if (choice === '2') {
        setCurrentStep('STRANDED_TYPE');
        setInputBuffer('');
      } else if (choice === '3') {
        setCurrentStep('SHELTER_LOC');
        setInputBuffer('');
      } else if (choice === '4') {
        setCurrentStep('WEATHER');
        setInputBuffer('');
      } else {
        alert("Invalid option. Enter 1, 2, 3, or 4.");
        setInputBuffer('');
      }
    } else if (currentStep === 'DANGER_COUNT') {
      const count = parseInt(choice) || 1;
      const tId = `USSD-${Math.floor(1000 + Math.random() * 9000)}`;
      setTicketNumber(tId);
      setCurrentStep('CONFIRMATION');
      setInputBuffer('');
    } else if (currentStep === 'STRANDED_TYPE') {
      const tId = `EVAC-${Math.floor(2000 + Math.random() * 8000)}`;
      setTicketNumber(tId);
      setCurrentStep('CONFIRMATION');
      setInputBuffer('');
    } else if (currentStep === 'SHELTER_LOC' || currentStep === 'WEATHER' || currentStep === 'CONFIRMATION') {
      handleReset();
    }
  };

  const handleReset = () => {
    setCurrentStep('IDLE');
    setDialedCode('*123#');
    setInputBuffer('');
    setTicketNumber('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14151A]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex flex-col items-center">
        {/* Close Button on Modal Backdrop */}
        <button
          onClick={() => toggleUSSDModal(false)}
          className="absolute -top-12 right-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 text-xs font-semibold backdrop-blur-md cursor-pointer transition-all"
        >
          <X className="w-4 h-4" />
          <span>Close Simulator</span>
        </button>

        {/* 2G FEATURE PHONE FRAME */}
        <div className="w-full max-w-[320px] bg-[#14151A] rounded-[38px] p-5 shadow-xl border-4 border-[#35363F] flex flex-col items-center relative select-none">
          {/* Speaker grill */}
          <div className="w-16 h-1.5 bg-[#26272E] rounded-full mb-3" />

          {/* 2G LCD SCREEN (Monochrome Cyan/Green Backlit) */}
          <div className="w-full h-56 bg-[#14251F] border-4 border-[#101116] rounded-lg p-3 font-data text-[#7E9AC4] text-xs flex flex-col justify-between shadow-inner relative overflow-hidden dark:text-[#E0E0E0]">
            {/* Status bar */}
            <div className="flex items-center justify-between text-[10px] pb-1 border-b border-[#CFE6D8]/20 bg-[#7CC99A] text-[#14251F] dark:border-[#14532D]">
              <div className="flex items-center gap-1">
                <Signal className="w-3 h-3 text-[#5BBF7A]" />
                <span className="font-bold">2G BSNL</span>
              </div>
              <div className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-[#7E9AC4] animate-pulse dark:text-[#E0E0E0]" />
                <span>USSD</span>
                <BatteryCharging className="w-3 h-3 text-[#7E9AC4] ml-1 dark:text-[#E0E0E0]" />
              </div>
            </div>

            {/* Screen Content Body */}
            <div className="flex-1 py-2 leading-tight overflow-y-auto whitespace-pre-wrap">
              {currentStep === 'IDLE' && (
                <div className="flex flex-col justify-center items-center h-full text-center">
                  <div className="text-[11px] bg-[#5BBF7A]/80 text-[#14251F] dark:text-[#0F0F0F] mb-1">NEXORA 2G GATEWAY</div>
                  <div className="text-xl font-bold text-white tracking-widest bg-[#14251F]/60 px-3 py-1 rounded border border-[#126B34]/30">
                    {dialedCode || '_'}
                  </div>
                  <div className="text-[10px] bg-[#5BBF7A]/70 text-[#14251F] mt-3">
                    Press [CALL] to dial emergency USSD
                  </div>
                </div>
              )}

              {currentStep === 'MENU' && (
                <div>
                  <div className="font-bold text-white border-b border-[#CFE6D8]/30 pb-1 mb-1 dark:border-[#14532D]">
                    NEXORA DISASTER RELIEF
                  </div>
                  <div>1. Immediate Danger / SOS</div>
                  <div>2. Stranded - Need Evac</div>
                  <div>3. Nearest Safe Shelter</div>
                  <div>4. Brahmaputra Water Lvl</div>
                  <div className="mt-2 text-white font-bold">Reply (1-4): {inputBuffer}_</div>
                </div>
              )}

              {currentStep === 'DANGER_COUNT' && (
                <div>
                  <div className="font-bold bg-[#D9A03A] text-[#241B0B] pb-1 border-b border-[#CFE6D8]/30 dark:border-[#14532D]">
                    ! EMERGENCY SOS REPORT !
                  </div>
                  <div className="mt-1">How many people trapped?</div>
                  <div className="text-[10px] bg-[#7CC99A] text-[#14251F] mt-1">Enter number (e.g. 4):</div>
                  <div className="mt-2 text-white font-bold text-sm">Headcount: {inputBuffer}_</div>
                </div>
              )}

              {currentStep === 'STRANDED_TYPE' && (
                <div>
                  <div className="font-bold text-white pb-1 border-b border-[#CFE6D8]/30 dark:border-[#14532D]">
                    EVACUATION LOCATION
                  </div>
                  <div className="mt-1">1. Rooftop / High tree</div>
                  <div>2. Embankment slope</div>
                  <div>3. Ground floor / Water &gt;1m</div>
                  <div className="mt-2 text-white font-bold">Reply (1-3): {inputBuffer}_</div>
                </div>
              )}

              {currentStep === 'CONFIRMATION' && (
                <div>
                  <div className="font-bold bg-[#7CC99A] text-[#14251F] pb-1 border-b border-[#CFE6D8]/30 dark:border-[#14532D]">
                    ✓ SOS DISPATCHED
                  </div>
                  <div className="mt-1 text-white">Ticket: #{ticketNumber}</div>
                  <div className="mt-1">NDRF Column Alpha alerted. Stay on high ground. Keep phone on.</div>
                  <div className="mt-2 text-[10px] text-[#7E9AC4] dark:text-[#E0E0E0]">Press [END] to close session.</div>
                </div>
              )}

              {currentStep === 'SHELTER_LOC' && (
                <div>
                  <div className="font-bold text-white pb-1 border-b border-[#CFE6D8]/30 dark:border-[#14532D]">
                    NEAREST RELIEF CAMP
                  </div>
                  <div className="mt-1 text-white">Pragati High School</div>
                  <div>Distance: 1.4 km SW</div>
                  <div>Available: 128 beds</div>
                  <div>Rations: Food + Meds OK</div>
                  <div className="mt-2 text-[10px] text-[#7E9AC4] dark:text-[#E0E0E0]">SMS landmark guide sent to your number.</div>
                </div>
              )}

              {currentStep === 'WEATHER' && (
                <div>
                  <div className="font-bold text-white pb-1 border-b border-[#CFE6D8]/30 dark:border-[#14532D]">
                    RIVER BASIN ALERT
                  </div>
                  <div className="mt-1">Water Lvl: {riverLevelMeters}m (Danger: 49.68m)</div>
                  <div>Rainfall: {rainfallMmPerHour}mm/hr</div>
                  <div className="bg-[#D9A03A] text-[#241B0B] mt-1">Warning: Pandu Ghat & Fancy Bazar lowlands submerged.</div>
                </div>
              )}
            </div>

            {/* Screen footer softkeys */}
            <div className="flex justify-between text-[9px] pt-1 border-t border-[#CFE6D8]/20 bg-[#7CC99A] text-[#14251F] dark:border-[#14532D]">
              <span>{currentStep === 'IDLE' ? 'Options' : 'Back'}</span>
              <span className="font-bold text-white uppercase tracking-wider">
                {currentStep === 'IDLE' ? 'Dial' : 'Send'}
              </span>
            </div>
          </div>

          {/* 2G NAV & CONTROL BUTTONS */}
          <div className="grid grid-cols-3 gap-2 w-full mt-4">
            {/* CALL / SEND BUTTON (Green) */}
            <button
              onClick={handleCall}
              className="h-10 bg-[#126B34] hover:bg-[#1C6B45] active:scale-95 text-white rounded-lg font-bold flex items-center justify-center text-xs transition-all shadow-md cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 mr-1" />
              <span>{currentStep === 'IDLE' ? 'CALL' : 'SEND'}</span>
            </button>

            {/* RESET / CLEAR */}
            <button
              onClick={handleDelete}
              className="h-10 bg-[#1C1D22] hover:bg-[#26272E] active:scale-95 text-[#E4E4E0] rounded-lg font-bold flex items-center justify-center text-xs transition-all shadow-md cursor-pointer"
            >
              <Delete className="w-4 h-4" />
            </button>

            {/* END / HANGUP (Red) */}
            <button
              onClick={handleReset}
              className="h-10 bg-[#B42318] hover:bg-[#9A1C13] active:scale-95 text-white rounded-lg font-bold flex items-center justify-center text-xs transition-all shadow-md cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              <span>END</span>
            </button>
          </div>

          {/* NUMERIC 12-KEY KEYPAD */}
          <div className="grid grid-cols-3 gap-2 w-full mt-3 font-data">
            {[
              { key: '1', sub: '' },
              { key: '2', sub: 'ABC' },
              { key: '3', sub: 'DEF' },
              { key: '4', sub: 'GHI' },
              { key: '5', sub: 'JKL' },
              { key: '6', sub: 'MNO' },
              { key: '7', sub: 'PQRS' },
              { key: '8', sub: 'TUV' },
              { key: '9', sub: 'WXYZ' },
              { key: '*', sub: '' },
              { key: '0', sub: '+' },
              { key: '#', sub: '' },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => handleKeyPress(btn.key)}
                className="h-11 bg-[#1C1D22] hover:bg-[#26272E] active:bg-[#14151A] border border-[#35363F] text-white rounded-xl flex flex-col items-center justify-center shadow transition-all cursor-pointer"
              >
                <span className="text-base font-bold leading-none">{btn.key}</span>
                {btn.sub && <span className="text-[8px] text-[#6B6D77] font-sans tracking-widest leading-none mt-0.5 dark:text-[#D0D0D0]">{btn.sub}</span>}
              </button>
            ))}
          </div>

          {/* Mic pinhole */}
          <div className="w-2 h-2 bg-[#1C1D22] rounded-full mt-3 border border-[#35363F]" />
        </div>
      </div>
    </div>
  );
};
