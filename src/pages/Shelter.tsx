import React from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { ShelterManagerView } from '../components/shelter/ShelterManagerView';
import { ArrowLeft, Home } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';
import { getTranslation } from '../i18n/translations';

export const ShelterPage: React.FC = () => {
  const { setCurrentView, currentLanguage } = useNexoraStore();
  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  return (
    <div data-testid="shelter-page" className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col font-body">
      <TopBar />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 pt-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentView('COMMAND_DASHBOARD')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#212121] hover:bg-[#EEF2F8] dark:hover:bg-[#1C1D22] text-[#6B6D77] dark:text-[#D0D0D0] hover:text-[#1A3A6B] dark:hover:text-[#F1F1EF] border border-[#DEDEDA] dark:border-[#B4B4B4] text-xs font-semibold transition-all cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('nav_dashboard', 'Dashboard')}</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#6B6D77] dark:text-[#D0D0D0]">
          <Home className="w-4 h-4 text-[#126B34] dark:text-[#D0D0D0]" />
          <span>{t('role_shelter_metric', 'Camp Logistics Mode')}</span>
        </div>
      </div>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6">
        <ShelterManagerView />
      </main>
    </div>
  );
};
