'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  
  const navItems = [
    {
      name: 'Home',
      href: '/',
      icon: <Home className="h-4 w-4" />
    },
    {
      name: 'All Jobs',
      href: '/jobs',
      icon: <FileText className="h-4 w-4" />
    }
  ];

  return (
    <nav className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight gradient-text hidden sm:block">
              LaTeX Converter
            </span>
          </Link>
          
          <div className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                  pathname === item.href 
                    ? "bg-primary/10 text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {item.icon}
                <span className="hidden md:inline">{item.name}</span>
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden lg:block">
            Handwriting to LaTeX
          </span>
        </div>
      </div>
    </nav>
  );
}
