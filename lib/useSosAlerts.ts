import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function useSosAlerts() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeRef = useRef<boolean>(false);

  const startSosAlerts = useCallback(() => {
    activeRef.current = true;

    const triggerSmsSequence = () => {
      if (!activeRef.current) return;
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          if (!activeRef.current) return;

          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: contacts, error } = await supabase
            .from('trusted_contacts')
            .select('phone')
            .eq('user_id', user.id);

          if (error || !contacts || contacts.length === 0) return;

          const numbers = contacts.map(c => {
            if (!c.phone) return null;
            let p = c.phone.trim().replace(/\s|-/g, "");
            if (p.startsWith("+")) p = p.slice(1);
            if (p.length === 10) return "91" + p;
            if (p.startsWith("91")) return p;
            return p;
          }).filter(Boolean) as string[];

          if (numbers.length === 0) return;

          const userName = user.user_metadata?.full_name || user.email || 'A user';
          const { latitude, longitude } = position.coords;

          await fetch('/api/sos-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers, latitude, longitude, userName })
          });
        } catch (err) {
          // silently catch
        }
      }, () => {
        // handle geolocation error silently
      });
    };

    timerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      triggerSmsSequence();

      intervalRef.current = setInterval(() => {
        if (!activeRef.current) return;
        triggerSmsSequence();
      }, 240000);
    }, 8000);
  }, []);

  const stopSosAlerts = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopSosAlerts();
    };
  }, [stopSosAlerts]);

  return { startSosAlerts, stopSosAlerts };
}
