import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export const useReferral = () => {
  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      // Store referral code in localStorage for later use
      localStorage.setItem('verxio_referral_code', ref);
    }
  }, [searchParams]);

  const getStoredReferralCode = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('verxio_referral_code');
    }
    return null;
  };

  const clearReferralCode = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('verxio_referral_code');
    }
    setReferralCode(null);
  };

  return {
    referralCode,
    getStoredReferralCode,
    clearReferralCode
  };
};
