import React from 'react';
import { Shield, Smartphone, Home } from 'lucide-react';
import { useNexoraStore, UserRole } from '../../store/useNexoraStore';

/**
 * Authority workspace switcher â€” the 3 sub-roles that live inside the
 * Authority command UI (DDMO / Field Responder / Shelter Manager).
 * Citizens never see this control; it renders only for authority users.
 */
interface AuthorityOption {
  role: UserRole;
  label: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const OPTIONS: AuthorityOption[] = [
  { role: 'DDMO_OFFICER', label: 'Command', title: 'DDMO Authority â€” Command Dashboard', icon: Shield },
  { role: 'FIELD_RESPONDER', label: 'Responder', title: 'Field Responder â€” Mobile Rescue Mode', icon: Smartphone },
  { role: 'SHELTER_MANAGER', label: 'Shelter', title: 'Shelter Manager â€” Camp Logistics Mode', icon: Home },
];

export const AuthoritySwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { userRole, setUserRole } = useNexoraStore();

  return (
    <div
      role="radiogroup"
      aria-label="Authority workspace"
      className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-[#F4F4F1] border border-[#DEDEDA] dark:bg-[#262626] dark:border-[#B4B4B4] ${className ?? ''}`}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = userRole === opt.role;
        return (
          <button
            key={opt.role}
            role="radio"
            aria-checked={active}
            data-role-switch={opt.role}
            onClick={() => setUserRole(opt.role)}
            title={opt.title}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
              active
                ? 'bg-[#1A3A6B] text-white shadow-sm shadow-[#1A3A6B]/25 font-bold'
                : 'text-[#5A5C66] dark:text-[#D0D0D0] hover:text-[#1A3A6B] dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/10'
            }`}
          >
            <Icon className={`w-3 h-3 ${active ? 'text-white' : 'text-[#74767F] dark:text-[#D0D0D0]'}`} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};