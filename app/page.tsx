import Link from "next/link";
import { Shield, MapPin, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-primary/20 blur-[100px] rounded-full -translate-y-1/2 pointer-events-none" />
      
      <div className="z-10 flex flex-col items-center text-center max-w-3xl space-y-8">
        <div className="bg-primary/10 p-4 rounded-full mb-4">
          <Shield className="w-16 h-16 text-primary" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          Raksh<span className="text-primary">AK</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Proactive women's safety assistant with AI-powered route checking, deterrent mode, and instant SOS capabilities.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mt-8">
          <Link 
            href="/dashboard"
            className="px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-all text-lg shadow-lg shadow-primary/25"
          >
            Enter Demo
          </Link>
          <Link 
            href="/login"
            className="px-8 py-4 bg-card text-card-foreground border border-white/10 font-semibold rounded-full hover:bg-muted transition-all text-lg"
          >
            Login / Signup
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full text-left">
          <div className="p-6 rounded-2xl glass flex flex-col gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <h3 className="font-semibold text-lg">Instant SOS</h3>
            <p className="text-sm text-muted-foreground">Trigger stealth or deterrent modes instantly when in danger.</p>
          </div>
          <div className="p-6 rounded-2xl glass flex flex-col gap-3">
            <MapPin className="w-8 h-8 text-primary" />
            <h3 className="font-semibold text-lg">Safe Routes</h3>
            <p className="text-sm text-muted-foreground">AI checks your route for safety and suggests better alternatives.</p>
          </div>
          <div className="p-6 rounded-2xl glass flex flex-col gap-3">
            <Users className="w-8 h-8 text-primary" />
            <h3 className="font-semibold text-lg">Community</h3>
            <p className="text-sm text-muted-foreground">Crowdsourced safety reporting for better local awareness.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
