'use client';

import Link from 'next/link';
import { Building2, Search, ChevronRight, Menu, X, Home, Zap, Images, Users, Phone, MessageCircle, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getImageUrl } from '@/lib/api';
import { useBranding, getCompanyName } from '@/hooks/use-branding';
import { BrandLogo } from '@/components/brand-logo';

const NAV_LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/features', label: 'Features', icon: Zap },
  { href: '/gallery', label: 'Gallery', icon: Images },
  { href: '/about', label: 'About Us', icon: Users },
  { href: '/about#company-profile', label: 'Company Profile', icon: FileText },
  { href: '/contact', label: 'Contact', icon: Phone },
];

interface PublicNavbarProps {
  currentPage?: string;
}

export function PublicNavbar({ currentPage }: PublicNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const branding = useBranding();
  const activeHref = currentPage ?? pathname;

  // Close the menu on navigation; lock page scroll while it is open
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const phone = branding.supportPhone?.trim();
  const whatsapp = branding.whatsappLink || (branding.whatsappNumber ? 'https://wa.me/' + branding.whatsappNumber.replace(/\D/g, '') : '');

  const companyName = getCompanyName(branding);
  const logoUrl = branding.logo
    ? branding.logo.startsWith('http') ? branding.logo : getImageUrl(branding.logo)
    : '';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled ? 'py-2' : 'py-4',
      )}
    >
      <div className={cn(
        'mx-auto transition-all duration-300',
        scrolled ? 'max-w-6xl px-3 md:px-4' : 'max-w-7xl px-4 md:px-6',
      )}>
        <div className={cn(
          'flex items-center justify-between transition-all duration-300',
          scrolled
            ? 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl shadow-lg shadow-black/[0.06] rounded-2xl pl-3 pr-2 md:px-5 h-14 border border-gray-100 dark:border-gray-800'
            : 'bg-transparent px-0 h-16',
        )}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            {logoUrl ? (
              scrolled ? (
                <>
                  <BrandLogo src={logoUrl} alt={companyName} className="w-9 h-9 rounded-xl shadow-sm" />
                </>
              ) : (
                <BrandLogo src={logoUrl} alt={companyName} className="w-9 h-9 rounded-xl shadow-sm" />
              )
            ) : (
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                scrolled ? 'bg-green-700' : 'bg-white/20 backdrop-blur-sm border border-white/30',
              )}>
                <Building2 className="w-4 h-4 text-white" />
              </div>
            )}
            <span className={cn(
              'text-base font-bold tracking-tight transition-colors',
              scrolled ? 'text-green-700 dark:text-green-400' : 'text-white',
            )}>
              {companyName}
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className={cn(
            'hidden md:flex items-center gap-1 rounded-xl px-2 py-1 transition-all duration-300',
            scrolled ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white/10 backdrop-blur-sm border border-white/20',
          )}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  activeHref === link.href
                    ? scrolled
                      ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30'
                      : 'text-white bg-white/20'
                    : scrolled
                      ? 'text-gray-600 dark:text-gray-400 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-gray-800'
                      : 'text-white/80 hover:text-white hover:bg-white/15',
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Mobile: search icon only */}
            <Link
              href="/properties"
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-xl transition-all md:w-8 md:h-8',
                scrolled
                  ? 'text-gray-500 hover:text-green-700 hover:bg-green-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  : 'text-white/80 hover:text-white hover:bg-white/15',
              )}
            >
              <Search className="w-4 h-4" />
            </Link>

            {/* Mobile: menu */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className={cn(
                'md:hidden flex items-center justify-center w-10 h-10 rounded-xl transition-all',
                scrolled
                  ? 'bg-green-700 text-white shadow-sm shadow-green-900/20'
                  : 'bg-white/15 text-white border border-white/25 backdrop-blur-sm',
              )}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop only */}
            <Link
              href="/auth/login"
              className={cn(
                'hidden md:block text-sm font-medium px-3 py-1.5 rounded-xl transition-all',
                scrolled
                  ? 'text-gray-600 dark:text-gray-400 hover:text-green-700 hover:bg-green-50 dark:hover:bg-gray-800'
                  : 'text-white/85 hover:text-white hover:bg-white/15',
              )}
            >
              Log in
            </Link>

            <Link href="/auth/register" className="hidden md:block">
              <div className={cn(
                'flex items-center gap-1.5 pl-4 pr-3 py-2 rounded-xl text-sm font-semibold transition-all',
                scrolled
                  ? 'bg-green-700 hover:bg-green-600 text-white shadow-sm shadow-green-900/20'
                  : 'bg-white text-green-800 hover:bg-green-50',
              )}>
                Get Started
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </nav>

    {/* Mobile menu sheet */}
    <div
      className={cn('md:hidden fixed inset-0 z-[60] transition-opacity duration-300', menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
      aria-hidden={!menuOpen}
    >
      <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          'absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-gray-950',
          menuOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-5 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            {logoUrl && <BrandLogo src={logoUrl} alt={companyName} className="h-9 w-9 rounded-xl" />}
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white">{companyName}</span>
          </div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" tabIndex={menuOpen ? 0 : -1}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Site">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = activeHref === href;
            return (
              <Link key={href} href={href} tabIndex={menuOpen ? 0 : -1}
                className={cn(
                  'flex items-center gap-3.5 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors',
                  active ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900',
                )}>
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', active ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400')}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1">{label}</span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </Link>
            );
          })}

          {(phone || whatsapp) && (
            <div className="mt-5 grid grid-cols-2 gap-2 px-1">
              {phone && (
                <a href={'tel:' + phone} tabIndex={menuOpen ? 0 : -1} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-800 dark:text-gray-200">
                  <Phone className="h-4 w-4 text-green-700" /> Call us
                </a>
              )}
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" tabIndex={menuOpen ? 0 : -1} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-800 dark:text-gray-200">
                  <MessageCircle className="h-4 w-4 text-green-700" /> WhatsApp
                </a>
              )}
            </div>
          )}
        </nav>

        <div className="grid gap-2 border-t border-gray-100 p-4 dark:border-gray-800">
          <Link href="/auth/register" tabIndex={menuOpen ? 0 : -1} className="flex items-center justify-center gap-1.5 rounded-xl bg-green-700 py-3 text-sm font-semibold text-white shadow-sm shadow-green-900/20">
            Get Started <ChevronRight className="h-4 w-4 opacity-80" />
          </Link>
          <Link href="/auth/login" tabIndex={menuOpen ? 0 : -1} className="flex items-center justify-center rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-gray-100">
            Log in
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
