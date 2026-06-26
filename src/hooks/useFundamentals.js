import { useState, useEffect } from 'react';
import { fetchAllFundamentals } from '../api/nseFinance';

export function useFundamentals() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchAllFundamentals()
      .then(d => {
        setData(d);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
