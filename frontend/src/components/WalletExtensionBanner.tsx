import React from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useTranslation } from 'react-i18next';

export const WalletExtensionBanner: React.FC = () => {
  const { isExtensionAvailable } = useWallet();
  const { t } = useTranslation();

  if (isExtensionAvailable) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 text-amber-500">
        <AlertTriangle size={18} />
        <span className="text-sm font-medium">
          {t(
            'wallet.extensionMissing',
            'Freighter extension not detected. Please install it to interact with the Stellar network.'
          )}
        </span>
      </div>
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-black rounded-md text-xs font-bold hover:bg-amber-600 transition-colors shrink-0"
      >
        <Download size={14} />
        {t('wallet.installFreighter', 'Install Freighter')}
      </a>
    </div>
  );
};
