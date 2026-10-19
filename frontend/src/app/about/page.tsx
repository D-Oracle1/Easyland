'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  TrendingUp,
  Star,
  ArrowRight,
  Target,
  Eye,
  Heart,
  Gem,
  Loader2,
  ShieldCheck,
  Handshake,
  BarChart3,
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { PageHero } from '@/components/layout/page-hero';
import { api, getImageUrl } from '@/lib/api';
import { useTenantResolution } from '@/hooks/use-tenant-resolution';

const ICON_LIST = [Building2, Target, Users, ShieldCheck, Handshake, BarChart3, Eye, Heart, Gem, TrendingUp, Star];

function resolveImg(src: string) {
  if (!src) return '';
  return src.startsWith('http') ? src : getImageUrl(src);
}

export default function AboutPage() {
  const [cms, setCms] = useState<Record<string, any> | null>(null);
  const [cmsLoading, setCmsLoading] = useState(true);
  const { tenantReady } = useTenantResolution();

  useEffect(() => {
    if (!tenantReady) return;
    api.get('/cms/public')
      .then((raw) => {
        const data = raw?.data || raw;
        if (data && typeof data === 'object') setCms(data);
      })
      .catch(() => {})
      .finally(() => setCmsLoading(false));
  }, [tenantReady]);

  // The page shows a loader until CMS content arrives, so the browser's own
  // jump to #company-profile happens too early — scroll once it has rendered.
  useEffect(() => {
    if (cmsLoading || window.location.hash !== '#company-profile') return;
    requestAnimationFrame(() => document.getElementById('company-profile')?.scrollIntoView());
  }, [cmsLoading]);

  const companyName  = cms?.branding?.companyName || 'Our Company';
  const about        = cms?.about        || {};
  const mission      = cms?.mission      || {};
  const coreValues   = cms?.core_values  || {};
  const stats        = cms?.stats        || {};
  const agents       = cms?.agents       || {};
  const profile      = cms?.company_profile || {};

  const heroImage    = resolveImg(about.image || '');
  const storyImage   = resolveImg(about.storyImage || '');

  // Content helpers — handle non-string CMS values defensively
  const plainText = (html: any) => (typeof html === 'string' ? html : '')
    .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const aboutText  = plainText(about.content || '');
  const storyText  = plainText(about.story   || mission.missionContent || '');
  const introParagraph = aboutText;
  const introTitle = about.storyTitle || about.title || `About ${companyName}`;

  // Company Profile — only fields the company has entered in the CMS are shown.
  // The registration number is only ever displayed next to the registered name.
  const portfolio: string[] = (Array.isArray(profile.portfolio) ? profile.portfolio : [])
    .map((p: any) => (typeof p === 'string' ? p : p?.name || '').trim())
    .filter(Boolean);
  const profileFacts = [
    { label: 'Registration number', value: profile.legalName ? profile.registrationNumber : '' },
    { label: 'Established', value: profile.establishedYear },
    { label: 'Ambition', value: profile.ambition },
    { label: 'Sectors served', value: profile.sectors },
  ].filter((f) => String(f.value ?? '').trim());
  const hasProfile = profileFacts.length > 0 || portfolio.length > 0;

  // Service/value items — prefer about.items, fall back to coreValues.values
  const serviceItems: any[] = (about.items?.length ? about.items : coreValues.values) || [];

  // Stats
  const statItems: any[] = stats.stats || [];

  // Team / agents
  const teamMembers: any[] = agents.agents || agents.members || [];

  if (cmsLoading) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white">
      <PublicNavbar currentPage="/about" />
      <MobileBottomNav />

      {/* ── 1. HERO BANNER ─────────────────────────────────────────── */}
      <PageHero eyebrow="Who we are" title="About Us" image={heroImage} breadcrumb="About Us" />

      {/* ── 2. INTRO — SINGLE JUSTIFIED PARAGRAPH ──────────────────── */}
      <section id={hasProfile ? undefined : 'company-profile'} className="py-20 px-4 bg-white scroll-mt-24">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-6">
            {introTitle}
          </h2>
          {introParagraph && (
            <p className="text-gray-600 leading-relaxed text-[15px] text-justify">
              {introParagraph}
            </p>
          )}
          {storyText && storyText !== aboutText && (
            <p className="text-gray-600 leading-relaxed text-[15px] text-justify mt-4">
              {storyText}
            </p>
          )}
        </div>
      </section>

      {/* ── 2b. COMPANY PROFILE (target of the "Company Profile" links) ── */}
      {hasProfile && (
        <section id="company-profile" aria-labelledby="company-profile-heading" className="pb-20 px-4 bg-white scroll-mt-24">
          <div className="container mx-auto">
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6 md:p-10">
              <span className="text-accent font-semibold text-sm uppercase tracking-wider">Company Profile</span>
              <h2 id="company-profile-heading" className="text-2xl md:text-3xl font-bold text-gray-900 mt-2 mb-6">
                {profile.legalName || companyName}
              </h2>
              {profileFacts.length > 0 && (
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {profileFacts.map((f) => (
                    <div key={f.label} className="rounded-2xl bg-white p-5 shadow-sm">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{f.label}</dt>
                      <dd className="mt-1 text-base font-semibold text-gray-900 break-words">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {portfolio.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Portfolio</h3>
                  <ul className="flex flex-wrap gap-2">
                    {portfolio.map((name) => (
                      <li key={name} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                        <Building2 className="w-4 h-4 text-accent" aria-hidden="true" />
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. SPLIT FULL-WIDTH IMAGES ─────────────────────────────── */}
      <section className="w-full flex flex-col md:flex-row h-[420px] md:h-[500px]">
        {/* Left — large image */}
        <div className="relative flex-1 bg-primary/20">
          {heroImage ? (
            <Image src={heroImage} alt={companyName} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60" />
          )}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Right — two stacked images */}
        <div className="relative flex-1 flex flex-col md:flex-row">
          <div className="relative flex-1 bg-primary/30">
            {storyImage ? (
              <Image src={storyImage} alt="" fill className="object-cover" />
            ) : heroImage ? (
              <Image src={heroImage} alt="" fill className="object-cover opacity-80" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent/30 to-primary/40" />
            )}
            <div className="absolute inset-0 bg-primary/20" />
          </div>
          <div className="relative flex-1 bg-accent/20">
            {heroImage ? (
              <Image src={heroImage} alt="" fill className="object-cover opacity-70" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tl from-primary/50 to-accent/20" />
            )}
            <div className="absolute inset-0 bg-primary/30" />
          </div>
        </div>
      </section>

      {/* ── 4. SOLUTIONS / SERVICES / CORE VALUES ───────────────────── */}
      {serviceItems.length > 0 && (
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {about.whyTitle || (about.items?.length ? 'What We Offer' : 'Our Core Values')}
            </h2>
            {about.whySubtitle && (
              <p className="text-gray-500 max-w-xl text-[15px]">{about.whySubtitle}</p>
            )}
          </div>

            <div className="grid md:grid-cols-3 gap-x-8 gap-y-8">
              {serviceItems.slice(0, 6).map((item: any, i: number) => {
                const Icon = ICON_LIST[i % ICON_LIST.length];
                const label = item.title || item.text || (typeof item === 'string' ? item : '');
                const desc  = item.description || '';
                return (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent transition-colors">
                      <Icon className="w-5 h-5 text-accent group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-accent/60">{String(i + 1).padStart(2, '0')}</span>
                        <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
                      </div>
                      {desc && <p className="text-gray-500 text-[13px] leading-relaxed">{desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      </section>
      )}

      {/* ── 5. MISSION & VISION BANNER ─────────────────────────────── */}
      {(mission.missionContent || mission.visionContent) && (
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-primary/95" />
        {heroImage && (
          <Image src={heroImage} alt="" fill className="object-cover opacity-10 mix-blend-luminosity" />
        )}
        <div className="container mx-auto relative z-10">
          {/* Mission & Vision cards */}
            <div className="grid md:grid-cols-2 gap-8">
              {mission.missionContent && (
                <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                    <Target className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{mission.missionTitle || 'Our Mission'}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{plainText(mission.missionContent)}</p>
                </div>
              )}
              {mission.visionContent && (
                <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                    <Eye className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{mission.visionTitle || 'Our Vision'}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{plainText(mission.visionContent)}</p>
                </div>
              )}
            </div>
        </div>
      </section>
      )}

      {/* ── 6. STATS COUNTER ───────────────────────────────────────── */}
      {statItems.length > 0 && (
        <section className="py-16 px-4 bg-gray-50 border-y border-gray-100">
          <div className="container mx-auto">
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              {statItems.slice(0, 3).map((stat: any, i: number) => (
                <div key={i} className="flex items-center gap-6 px-8 py-6">
                  <div>
                    <div className="text-4xl md:text-5xl font-bold text-primary leading-none">{stat.value}</div>
                    <div className="text-sm font-semibold text-gray-700 mt-1">{stat.label}</div>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed hidden sm:block flex-1">
                    {stat.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 7. TEAM MEMBERS ────────────────────────────────────────── */}
      {teamMembers.length > 0 && (
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-[300px_1fr] gap-12 items-start">
            {/* Left — heading + CTA */}
            <div className="lg:pt-8">
              <span className="text-accent font-semibold text-sm uppercase tracking-wider">Our People</span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4 leading-tight">
                Meet Our Expert Team
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mb-8">
                {agents.subtitle || `Behind every successful transaction is a dedicated ${companyName} professional who genuinely cares about your outcome.`}
              </p>
              <Link href="/contact">
                <Button className="bg-accent hover:bg-accent-600 text-white px-6">
                  Contact Us <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Right — agent cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamMembers.slice(0, 3).map((member: any, i: number) => {
                    const photo = resolveImg(member.photo || member.image || member.avatar || '');
                    const name  = member.name  || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Team Member';
                    const role  = (typeof member.role === 'string' ? member.role : member.role?.name) || member.title || 'Property Consultant';
                    return (
                      <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow group border border-gray-100">
                        <div className="relative h-56 bg-gray-100">
                          {photo ? (
                            <Image src={photo} alt={name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                              <Users className="w-16 h-16 text-primary/20" />
                            </div>
                          )}
                        </div>
                        <div className="p-4 text-center">
                          <h3 className="font-semibold text-gray-900">{name}</h3>
                          <p className="text-sm text-accent mt-0.5">{role}</p>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ── 8. CTA ─────────────────────────────────────────────────── */}
      <section className="py-16 md:py-20 px-4 bg-gray-50">
        <div className="container mx-auto">
          <div className="relative rounded-3xl overflow-hidden flex flex-col md:flex-row bg-gray-950 min-h-[340px]">
            {/* Decorative right panel */}
            <div className="relative order-first md:order-last w-full h-44 md:h-auto md:w-[38%] flex-shrink-0 overflow-hidden bg-green-900">
              <div className="absolute inset-0 opacity-[0.12]"
                style={{ backgroundImage: 'radial-gradient(circle, #4ade80 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
              <div className="absolute inset-0 bg-gradient-to-br from-green-800/50 via-green-900 to-gray-950" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Users className="w-36 h-36 text-green-400/10" strokeWidth={0.5} />
              </div>
            </div>
            {/* Content */}
            <div className="flex flex-col justify-center p-8 md:p-12 lg:p-14 flex-1">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-6 h-px bg-green-500" />
                <span className="text-green-400 text-xs font-semibold uppercase tracking-widest">Your Journey Starts Here</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight mb-4 max-w-md">
                Ready to Find Your Perfect Property?
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm">
                Browse current listings or contact {companyName} to ask about a property.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/properties">
                  <div className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all">
                    Browse Properties <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
                <Link href="/contact">
                  <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all">
                    Contact Us
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="md:hidden h-24" />
      <PublicFooter cmsData={cms?.footer} />
    </div>
  );
}
