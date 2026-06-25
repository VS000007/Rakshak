"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function TripleTapListener() {
  const router = useRouter();
  const pathname = usePathname();
  const tapsRef = useRef<number[]>([]);

  useEffect(() => {
    const handleTap = (e: MouseEvent | TouchEvent) => {
      const now = Date.now();
      tapsRef.current.push(now);

      // Keep only taps within the last 800ms
      tapsRef.current = tapsRef.current.filter(time => now - time <= 800);

      if (tapsRef.current.length >= 3) {
        tapsRef.current = []; // reset
        
        // Toggle behavior
        if (pathname === "/sos") {
          // If already on SOS, toggle off (cancel)
          router.push("/dashboard");
        } else {
          // If not on SOS, toggle on
          router.push("/sos");
        }
      }
    };

    document.addEventListener("mousedown", handleTap);
    document.addEventListener("touchstart", handleTap, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleTap);
      document.removeEventListener("touchstart", handleTap);
    };
  }, [pathname, router]);

  return null; // Headless component
}
