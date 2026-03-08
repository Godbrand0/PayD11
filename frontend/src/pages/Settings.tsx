import { useTranslation } from 'react-i18next';
import { useState, useRef } from 'react';

export default function Settings() {
  const { t, i18n } = useTranslation();

  // Orginization State
  const [orgName, setOrgName] = useState('Acme Corp');
  const [contactEmail, setContactEmail] = useState('admin@acmecorp.com');
  const [stablecoin, setStablecoin] = useState('USDC');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChangeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    // Simulate API request
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSaving(false);
    setSaveStatus('success');

    // Clear success message after 3s
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleCancel = () => {
    // Reset to mock original values
    setOrgName('Acme Corp');
    setContactEmail('admin@acmecorp.com');
    setStablecoin('USDC');
    setLogoPreview(null);
    setSaveStatus('idle');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-3xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            {t('settings.title') || 'Settings'}
          </h1>
        </div>
      </div>

      <div className="w-full flex flex-col gap-8">
        {/* Organization Settings Section */}
        <div className="w-full card glass noise p-8">
          <h2 className="text-xl font-bold mb-6 text-text">Organization Profile</h2>

          <div className="flex flex-col gap-6">
            {/* Logo Upload */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3">
                Organization Logo
              </label>
              <div className="flex items-center gap-6">
                <div
                  className="w-20 h-20 rounded-xl bg-black/20 border-2 border-dashed border-hi flex items-center justify-center overflow-hidden cursor-pointer hover:border-accent/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Org Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl opacity-50">🏢</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-black/20 hover:bg-black/40 border border-hi rounded-lg text-sm transition-colors text-text/80 font-medium"
                  >
                    Upload New Image
                  </button>
                  <p className="text-xs text-muted mt-2">
                    Recommended size: 256x256px. Max file size: 2MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full bg-black/20 border border-hi rounded-xl p-3 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all"
                  placeholder="e.g. Acme Corp"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-black/20 border border-hi rounded-xl p-3 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all"
                  placeholder="admin@example.com"
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                  Preferred Stablecoin
                </label>
                <p className="text-xs text-muted mb-1">
                  Default token used for payroll distributions.
                </p>
                <select
                  value={stablecoin}
                  onChange={(e) => setStablecoin(e.target.value)}
                  className="w-full bg-black/20 border border-hi rounded-xl p-3 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all"
                >
                  <option value="USDC">USDC (USD Coin)</option>
                  <option value="EURC">EURC (Euro Coin)</option>
                  <option value="XLM">XLM (Stellar Lumen)</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 mt-4 pt-6 border-t border-hi/50">
              {saveStatus === 'success' && (
                <span className="text-sm text-green-400 font-medium mr-auto animate-pulse">
                  Settings saved successfully!
                </span>
              )}

              <button
                onClick={handleCancel}
                className="px-6 py-2.5 rounded-xl font-bold bg-transparent border border-hi hover:bg-black/20 text-text transition-all"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                className="px-6 py-2.5 rounded-xl font-bold bg-accent hover:bg-accent/80 text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                disabled={isSaving}
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Existing Localization Section */}
        <div className="w-full card glass noise p-8">
          <div className="flex flex-col gap-3">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted">
              {t('settings.languageLabel') || 'Language'}
            </label>
            <p className="text-sm text-muted">
              {t('settings.languageDescription') ||
                'Choose your preferred user interface language.'}
            </p>
            <select
              value={i18n.language || 'en'}
              onChange={handleChangeLanguage}
              className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all mt-2"
            >
              <option value="en">{t('settings.languageEnglish') || 'English'}</option>
              <option value="es">{t('settings.languageSpanish') || 'Spanish'}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
