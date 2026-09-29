import React from 'react';
import { Shield, User, Smartphone, Home, ChevronDown } from 'lucide-react';
import { useNexoraStore, UserRole } from '../../store/useNexoraStore';

export const RoleSwitcher: React.FC = () => {
  const { userRole, setUserRole } = useNexoraStore();

  const roles: { role: UserRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { role: 'DDMO_OFFICER', label: 'DDMO Authority', icon: Shield },
    { role: 'CITIZEN', label: 'Citizen Portal', icon: User },
    { role: 'FIELD_RESPONDER', label: 'Field Responder', icon: Smartphone },
    { role: 'SHELTER_MANAGER', label: 'Shelter Manager', icon: Home }
  ];

  return (
    <div className="flex items-center gap-1 bg-[#F1F1EF]/90 p-1 rounded-xl border border-[#DEDEDA] dark:bg-[#262626] dark:border-[#3D3D3D]">
      {roles.map((r) => {
        const Icon = r.icon;
        const isActive = userRole === r.role;
        return (
          <button
            key={r.role}
            onClick={() => setUserRole(r.role)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${ isActive ? 'bg-[#12294D] text-white shadow-xs' : 'text-[#5A5C66] hover:text-[#14151A] hover:bg-white/60' } dark:text-[#D0D0D0] `}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#7E9AC4]' : ''} dark:text-[#E0E0E0] `}/>
            <span className="hidden md:inline">{r.label}</span>
          </button>
        );
      })}
    </div>
  );
};
