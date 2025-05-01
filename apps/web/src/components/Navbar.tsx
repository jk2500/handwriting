'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  
  const navItems = [
    {
      name: 'Home',
      href: '/',
      icon: <Home className="h-5 w-5" />
    },
    {
      name: 'All Jobs',
      href: '/jobs',
      icon: <FileText className="h-5 w-5" />
    }
  ];

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <div className="container mx-auto flex h-16 items-center px-4">
        <div className="mr-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              LaTeX Converter
            </span>
          </Link>
        </div>
        
        <div className="flex gap-1 md:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                pathname === item.href 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {item.icon}
              <span className="hidden md:inline">{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
} 