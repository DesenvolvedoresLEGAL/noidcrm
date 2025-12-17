import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Redirect to new Settings V2 layout
export default function Settings() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/app/settings/profile', { replace: true });
  }, [navigate]);

  return null;
}
