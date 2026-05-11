'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'ps_copyright_accepted';

export function CopyrightDisclaimerModal() {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-[#202124]">Copyright & Upload Policy</h2>
        </div>
        <div className="text-sm text-[#5F6368] space-y-3 mb-5">
          <p>Before uploading any content to Pocket School, please read and agree to the following:</p>
          <ul className="list-disc list-inside space-y-1.5 text-xs">
            <li>You confirm you hold the legal right to upload, share, and use all content you submit.</li>
            <li>You are solely responsible for ensuring uploaded materials do not infringe any third-party copyright, trademark, or intellectual property rights.</li>
            <li>Pocket School reserves the right to remove content that violates copyright laws without notice.</li>
            <li>Repeated violations may result in account suspension.</li>
          </ul>
          <p className="text-xs text-gray-400">By accepting, you acknowledge your responsibility as the uploader and agree to Pocket School&apos;s content policy.</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer mb-5">
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
          <span className="text-sm text-[#202124]">I confirm that I have the legal right to upload this content and accept full responsibility for it.</span>
        </label>
        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={!checked} onClick={accept}>
          Accept &amp; Continue
        </Button>
      </div>
    </div>
  );
}
