import React, { useEffect, useState, useRef } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  xBullModule,
  LobstrModule,
} from '@creit.tech/stellar-wallets-kit';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../hooks/useNotification';
import { WalletContext } from '../hooks/useWallet';

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExtensionAvailable, setIsExtensionAvailable] = useState(true);
  const kitRef = useRef<StellarWalletsKit | null>(null);
  const { t } = useTranslation();
  const { notify, notifySuccess, notifyError } = useNotification();

  const STORAGE_KEY = 'payd_last_wallet';

  useEffect(() => {
    const newKit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      modules: [new FreighterModule(), new xBullModule(), new LobstrModule()],
    });
    kitRef.current = newKit;

    // Check if Freighter is available (basic check)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    if (typeof window !== 'undefined' && !(window as any).freighter) {
      setIsExtensionAvailable(false);
    }

    // Silent reconnection
    const lastWallet = localStorage.getItem(STORAGE_KEY);
    if (lastWallet) {
      void (async () => {
        setIsConnecting(true);
        try {
          // In stellar-wallets-kit, you usually need to set the wallet first
          newKit.setWallet(lastWallet);
          const { address } = await newKit.getAddress();
          if (address) {
            setAddress(address);
            setWalletName(lastWallet);
          }
        } catch (error) {
          console.warn('Silent reconnection failed:', error);
          localStorage.removeItem(STORAGE_KEY);
        } finally {
          setIsConnecting(false);
        }
      })();
    }
  }, []);

  const connect = async () => {
    const kit = kitRef.current;
    if (!kit) return;

    setIsConnecting(true);
    try {
      await kit.openModal({
        modalTitle: t('wallet.modalTitle'),
        onWalletSelected: (option) => {
          void (async () => {
            try {
              const { address } = await kit.getAddress();
              setAddress(address);
              setWalletName(option.id);
              localStorage.setItem(STORAGE_KEY, option.id);
              notifySuccess(
                'Wallet connected',
                `${address.slice(0, 6)}...${address.slice(-4)} via ${option.id}`
              );
            } catch (err) {
              console.error('onWalletSelected error:', err);
            }
          })();
        },
        onClosed: () => {
          setIsConnecting(false);
        },
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      notifyError(
        'Wallet connection failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setWalletName(null);
    localStorage.removeItem(STORAGE_KEY);
    notify('Wallet disconnected');
  };

  const requireWallet = async <T,>(callback: () => Promise<T>): Promise<T> => {
    if (address) {
      return callback();
    }

    await connect();

    // Check again after modal interaction
    if (!address) {
      // If still no address, it likely means the user closed the modal or failed
      // For the sake of UX, we should probably throw an error that the caller can catch
      throw new Error('Wallet connection required to perform this action');
    }

    return callback();
  };

  const signTransaction = async (xdr: string) => {
    const kit = kitRef.current;
    if (!kit) throw new Error('Wallet kit not initialized');
    const result = await kit.signTransaction(xdr);
    return result.signedTxXdr;
  };

  return (
    <WalletContext
      value={{
        address,
        walletName,
        isConnecting,
        isExtensionAvailable,
        connect,
        disconnect,
        signTransaction,
        requireWallet,
      }}
    >
      {children}
    </WalletContext>
  );
};
