import Link from "next/link";
import { Home, MapPin, Users, User, ShieldAlert } from "lucide-react";

export default function BottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-t border-white/10 flex items-center justify-around px-4 pb-safe z-50">
      <Link href="/dashboard" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary transition-colors">
        <Home className="w-6 h-6" />
        <span className="text-[10px] mt-1 font-medium">Home</span>
      </Link>
      <Link href="/route-check" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary transition-colors">
        <MapPin className="w-6 h-6" />
        <span className="text-[10px] mt-1 font-medium">Routes</span>
      </Link>
      
      {/* Center SOS Button */}
      <Link href="/sos" className="relative -top-5 flex flex-col items-center justify-center w-14 h-14 bg-destructive text-destructive-foreground rounded-full shadow-lg shadow-destructive/30 hover:scale-105 transition-transform border-4 border-background">
        <ShieldAlert className="w-6 h-6" />
      </Link>

      <Link href="/community-report" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary transition-colors">
        <Users className="w-6 h-6" />
        <span className="text-[10px] mt-1 font-medium">Community</span>
      </Link>
      <Link href="/profile" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary transition-colors">
        <User className="w-6 h-6" />
        <span className="text-[10px] mt-1 font-medium">Profile</span>
      </Link>
    </div>
  );
}
