import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3,
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Clock3, Download, ExternalLink, Eye, Filter, ImagePlus, Instagram, LayoutDashboard,
  Link2, LoaderCircle, LogOut, Menu, MoreHorizontal, Plus, Search, Send,
  Settings2, Sparkles, Trash2, Users, WandSparkles, X, Zap,
} from 'lucide-react';
import { Route, Switch, Router as WouterRouter, Link, Redirect, useLocation } from 'wouter';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  useListBrands, useCreateBrand, useUpdateBrand, useDeleteBrand,
  useListAds, useCreateAd, useGetAd, useUpdateAd, useDeleteAd,
  useGetPublicAd, useRecordPublicAdEvent, useSubmitPublicLead,
  useListScheduledPosts, useCreateScheduledPost, useUpdateScheduledPost, useDeleteScheduledPost,
  useListLeads, useGetDashboard, useGetAnalytics, useListActivities,
  useListTeamMembers, useInviteTeamMember, useUpdateTeamMember, useRemoveTeamMember,
  useListSocialAccounts, useConnectSocialAccount, useDisconnectSocialAccount,
  getListBrandsQueryKey, getListAdsQueryKey, getGetDashboardQueryKey,
  getGetAnalyticsQueryKey, getListActivitiesQueryKey, getListTeamMembersQueryKey,
  getListScheduledPostsQueryKey, getListLeadsQueryKey, getListSocialAccountsQueryKey,
  getGetPublicAdQueryKey,
} from '@workspace/api-client-react';
import type { Ad, AdType, Brand, SocialPlatform, TeamRole } from '@workspace/api-client-react';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const appearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#d96543', colorForeground: '#292d3b', colorMutedForeground: '#747686',
    colorDanger: '#bd4740', colorBackground: '#fbf8f1', colorInput: '#fffdf8',
    colorInputForeground: '#292d3b', colorNeutral: '#ddd6c8', fontFamily: 'Manrope, sans-serif', borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf8f1] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#292d3b] font-bold', headerSubtitle: 'text-[#747686]',
    socialButtonsBlockButtonText: 'text-[#292d3b] font-semibold', formFieldLabel: 'text-[#292d3b] font-semibold',
    footerActionLink: 'text-[#bd573a] font-bold', footerActionText: 'text-[#747686]',
    dividerText: 'text-[#747686]', identityPreviewEditButton: 'text-[#bd573a]',
    formFieldSuccessText: 'text-[#287764]', alertText: 'text-[#9e3d37]',
    logoBox: 'rounded-xl', logoImage: 'object-contain', socialButtonsBlockButton: 'rounded-xl border-[#ddd6c8]',
    formButtonPrimary: 'rounded-xl bg-[#d96543] hover:bg-[#bd573a]', formFieldInput: 'rounded-xl border-[#ddd6c8] bg-[#fffdf8]',
    footerAction: 'text-[#747686]', dividerLine: 'bg-[#ddd6c8]', alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-lg border-[#ddd6c8]', formFieldRow: 'gap-2', main: 'gap-4',
  },
};
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }

type IconType = typeof LayoutDashboard;
const navigation: { href: string; label: string; icon: IconType; admin?: boolean }[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/brands', label: 'Brands', icon: Sparkles },
  { href: '/ads', label: 'Ad studio', icon: WandSparkles },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/social', label: 'Social accounts', icon: Link2 },
  { href: '/team', label: 'Team', icon: Users, admin: true },
];
const AD_TYPES: AdType[] = ['poll', 'quiz', 'spin_wheel', 'carousel', 'lead_form', 'swipe_cards'];
const PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'linkedin', 'x'];
const formatNum = (value?: number) => (value ?? 0).toLocaleString('en-US');
const shortDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const titleCase = (value?: string) => (value || '').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

function BrandMark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark ${small ? 'brand-mark-sm' : ''}`} aria-hidden="true"><i /><i /><i /></span>;
}
function Wordmark({ dark = false }: { dark?: boolean }) {
  return <span className={`wordmark ${dark ? 'wordmark-dark' : ''}`}><BrandMark small />adpilot</span>;
}
function Button({ children, onClick, variant = 'dark', className = '', type = 'button', disabled = false, testId }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'dark' | 'primary' | 'quiet' | 'outline' | 'danger';
  className?: string; type?: 'button' | 'submit'; disabled?: boolean; testId?: string;
}) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`button button-${variant} ${className}`}>{children}</button>;
}
function Input({ label, value, onChange, placeholder = '', type = 'text', testId, required = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; testId: string; required?: boolean;
}) {
  return <label className="field"><span>{label}</span><input required={required} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} data-testid={testId} /></label>;
}
function SelectField({ label, value, onChange, children, testId }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; testId: string }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId}>{children}</select></label>;
}
function LoadingState({ label = 'Gathering your workspace' }: { label?: string }) {
  return <div className="loading-panel" role="status" aria-live="polite"><div className="skeleton-line wide" /><div className="skeleton-grid"><i /><i /><i /></div><div className="skeleton-line" /><span>{label}</span></div>;
}
function ErrorState({ retry }: { retry: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><CircleHelp size={22} /></div><h3>We couldn’t load this view</h3><p>Check your connection, then try again.</p><Button variant="outline" onClick={retry}>Try again</Button></div>;
}
function EmptyState({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Sparkles size={22} /></div><h3>{title}</h3><p>{copy}</p>{action}</div>;
}
function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow || 'ADPILOT WORKSPACE'}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>;
}
function StatusPill({ status }: { status: string }) { return <span className={`status-pill status-${status}`}>{status}</span>; }
function StatTile({ label, value, change, accent }: { label: string; value: string; change?: number; accent?: boolean }) {
  return <article className={`stat-tile ${accent ? 'stat-accent' : ''}`}><span>{label}</span><strong>{value}</strong>{change !== undefined && <small className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change).toFixed(1)}% <em>vs prior period</em></small>}</article>;
}
function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-box"><Search size={16} /><input type="search" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} data-testid="input-search" /></label>;
}
function OverlayDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-label={title}><div className="dialog-head"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog" data-testid="button-close-dialog"><X size={18} /></button></div>{children}</section></div>;
}

function Landing() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return <main className="landing">
    <header className="landing-nav"><Link href="/" className="brand-link"><Wordmark /></Link><nav aria-label="Main navigation"><a href="#studio">Studio</a><a href="#workflow">How it works</a><a href="#teams">For agencies</a></nav><div className="landing-actions"><Link href="/sign-in" className="text-link">Sign in</Link><Link href="/sign-up" className="button button-dark">Start creating <ArrowRight size={15} /></Link></div></header>
    <section className="hero" id="studio"><div className="hero-copy"><div className="eyebrow"><span className="live-dot" /> THE SOCIAL AD STUDIO FOR AGENCIES</div><h1>Ideas deserve<br />to <span>move.</span></h1><p>Make social ads people actually want to play with. Build, schedule and learn across every brand you look after.</p><div className="hero-ctas"><Link href="/sign-up" className="button button-primary">Make your first ad <ArrowRight size={16} /></Link><a className="text-link" href="#workflow">See how it works <ArrowDownRight size={15} /></a></div><div className="hero-note"><span className="avatar-stack"><b>A</b><b>M</b><b>J</b></span><span>Built for the many hats<br /><strong>agency teams wear.</strong></span></div></div>
      <div className="hero-art" aria-label="Preview of an interactive social advertisement">
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
        <div className="campaign-float campaign-float-top"><span className="float-dot" /> LIVE PREVIEW <b>01 / 04</b></div>
        <AdArtwork image="/campaign-skin.jpg" headline="A little ritual. A lot of glow." accent="#eb8a54" cta="Find your ritual" interactive />
        <div className="floating-poll"><div className="poll-topline">QUICK PICK <span>01—02</span></div><strong>Your morning starts with…</strong><button type="button" onClick={(event) => event.currentTarget.classList.toggle('picked')}>A slow coffee</button><button type="button" onClick={(event) => event.currentTarget.classList.toggle('picked')}>A fresh face</button></div>
        <div className="campaign-float campaign-float-bottom"><Sparkles size={14} /> THIS ONE GETS PEOPLE TAPPING</div>
      </div>
    </section>
    <section className="trust-strip"><span>ONE STUDIO, EVERY CLIENT</span><div><b>BRIGHTWELL</b><b>north / south</b><b>GOOD FORM</b><b>VERA</b><b>FIELD NOTES</b></div></section>
    <section className="story-section" id="workflow"><div className="section-intro"><div className="eyebrow">THE AD IS THE EXPERIENCE</div><h2>Less scroll-past.<br /><span>More stop-and-play.</span></h2><p>Give a thumb something better to do. Polls, quizzes, wheels and swipe-through stories turn a passive impression into a little moment of participation.</p><Link href="/sign-up" className="text-link">See what you can make <ArrowRight size={15} /></Link></div><div className="story-visual"><AdArtwork image="/campaign-run.jpg" headline="Find your next stride." accent="#e37654" cta="Pick your pace" interactive /></div></section>
    <section className="feature-band"><div className="eyebrow">A LITTLE MORE FLOW, A LOT LESS TAB-HOPPING</div><div className="feature-row"><article><span>01</span><h3>Every brand, its own world.</h3><p>Keep each client’s voice, visuals and work in one thoughtfully organized place.</p></article><article><span>02</span><h3>Make it move in minutes.</h3><p>Change the copy, color or interaction and watch the ad update while you work.</p></article><article><span>03</span><h3>Keep the good stuff going.</h3><p>Plan posts, track participation and pass useful leads back to the right team.</p></article></div></section>
    <section className="end-cta" id="teams"><div className="eyebrow">YOUR NEXT GOOD IDEA, RIGHT HERE</div><h2>Go make a little<br /><span>noise.</span></h2><Link href="/sign-up" className="button button-dark">Start your studio <ArrowRight size={16} /></Link><div className="end-orbit" /></section>
    <footer className="landing-footer"><Link href="/" className="brand-link"><Wordmark dark /></Link><span>A good ad should give something back.</span><span>© 2025 AdPilot Studio</span></footer>
  </main>;
}

function AdArtwork({ image, headline, accent, cta, interactive = false, onAction, adType, options, onEvent }: {
  image?: string; headline: string; accent: string; cta: string; interactive?: boolean; onAction?: () => void;
  adType?: string; options?: string[]; onEvent?: (eventType: 'click' | 'completion', metadata?: Record<string, unknown>) => void;
}) {
  const [choice, setChoice] = useState('');
  const [slide, setSlide] = useState(0);
  const [spin, setSpin] = useState(false);
  const displayImage = image || '/campaign-skin.jpg';
  const kind = adType || (window as Window & { __adType?: string }).__adType || 'poll';
  return <article className={`ad-artwork ${interactive ? 'ad-shimmer' : ''}`} style={{ '--ad-accent': accent } as React.CSSProperties} data-testid="ad-live-preview">
    <div className="ad-visual" style={{ backgroundImage: `linear-gradient(180deg,rgba(23,27,37,.01) 40%,rgba(23,27,37,.65)),url("${displayImage}")` }}>
      <div className="ad-brand"><span className="ad-brand-dot" /> GOOD FORM <span>SPONSORED</span></div>
      <button type="button" className="ad-more" aria-label="Advertisement options"><MoreHorizontal size={18} /></button>
      <div className="ad-image-copy"><span className="ad-kicker">A VERY GOOD THING</span><h2>{headline || 'A little ritual. A lot of glow.'}</h2></div>
    </div>
    <div className="ad-interaction">
      <div className="ad-type-kicker">{titleCase(kind)} <span>YOUR TURN</span></div>
      {(kind) === 'poll' && <><p>What are you in the mood for?</p><div className="choice-row">{(options?.length ? options : ['A slow morning', 'A fresh start']).map((label) => <button type="button" key={label} onClick={() => { setChoice(label); onAction?.(); onEvent?.('completion', { choice: label }); }} className={choice === label ? 'selected-choice' : ''}>{label}</button>)}</div></>}
      {kind === 'quiz' && <><p>Pick your perfect match</p><div className="choice-row">{(options?.length ? options : ['Everyday', 'Weekend']).map((label) => <button type="button" key={label} onClick={() => { setChoice(label); onAction?.(); onEvent?.('completion', { choice: label }); }}>{label}</button>)}</div></>}
      {kind === 'carousel' && <><p>{slide === 0 ? 'Meet the little things that do a lot.' : 'Made for the moments that are yours.'}</p><div className="carousel-controls"><button type="button" aria-label="Previous slide" onClick={() => setSlide((slide + 1) % 2)}><ChevronLeft size={16} /></button><span>{slide + 1} / 2</span><button type="button" aria-label="Next slide" onClick={() => setSlide((slide + 1) % 2)}><ChevronRight size={16} /></button></div></>}
      {kind === 'spin_wheel' && <><p>{spin ? 'You won: a little something extra.' : 'A little luck looks good on you.'}</p><button type="button" className={`wheel-button ${spin ? 'wheel-spun' : ''}`} onClick={() => { setSpin(true); onAction?.(); onEvent?.('completion', { result: 'spun' }); }}>{spin ? 'Try again next time' : 'Give it a spin'} <span>↗</span></button></>}
      {kind === 'lead_form' && <><p>Get a good thing in your inbox.</p><button type="button" className="wheel-button" onClick={() => { setChoice('Joined'); onAction?.(); onEvent?.('click', { cta }); }}>{choice === 'Joined' ? 'You’re on the list' : cta} <ArrowRight size={14} /></button></>}
      {kind === 'swipe_cards' && <><p>Little things, big day energy.</p><button type="button" className="wheel-button" onClick={() => { setSlide((slide + 1) % 2); onAction?.(); }}>Swipe for more <ArrowRight size={14} /></button></>}
      <div className="ad-footer"><span>Made with <b>adpilot</b></span><span>•••</span></div>
    </div>
  </article>;
}

function AppShell({ children, role }: { children: React.ReactNode; role: TeamRole }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const canManage = role === 'agency_admin';
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="sidebar-logo"><Link href="/dashboard" className="brand-link"><Wordmark /></Link><button type="button" className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-switch"><div className="workspace-initial">S</div><span><small>YOUR STUDIO</small><b>Studio North</b></span><ChevronDown size={15} /></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-navigation" aria-label="Workspace navigation">{navigation.filter((item) => !item.admin || canManage).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`side-link ${location === href ? 'side-link-active' : ''}`} onClick={() => setMobileNav(false)} data-testid={`nav-${href.slice(1)}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{href === '/ads' && <kbd>⌘K</kbd>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="side-tip"><span><Sparkles size={15} /></span><b>Small idea, big impact.</b><p>Keep your clients in the loop with a live ad preview.</p><Link href="/ads/new">Make one now <ArrowRight size={13} /></Link></div><div className="profile-row"><div className="profile-avatar">{(user?.firstName || user?.emailAddresses[0]?.emailAddress || 'A').slice(0, 1).toUpperCase()}</div><div className="profile-info"><b>{user?.fullName || 'Agency team'}</b><small>{role.replaceAll('_', ' ')}</small></div><button type="button" className="icon-button profile-logout" onClick={() => signOut({ redirectUrl: basePath || '/' })} aria-label="Sign out" data-testid="button-sign-out"><LogOut size={16} /></button></div></div>
    </aside>
    {mobileNav && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
    <div className="main-column"><header className="topbar"><button type="button" className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu" data-testid="button-open-menu"><Menu size={20} /></button><div className="breadcrumb"><span>Studio North</span><ChevronRight size={14} /><b>{navigation.find((item) => location.startsWith(item.href))?.label || 'Workspace'}</b></div><div className="topbar-actions"><span className="workspace-indicator"><i /> All systems go</span><button type="button" className="top-avatar" aria-label="Account profile">{(user?.firstName || 'A').slice(0, 1).toUpperCase()}</button></div></header><main className="workspace-content page-enter">{children}</main></div>
  </div>;
}
function SecureWorkspace({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [, setLocation] = useLocation();
  useEffect(() => { if (isLoaded && !isSignedIn) setLocation('/'); }, [isLoaded, isSignedIn, setLocation]);
  if (!isLoaded) return <div className="auth-loading"><LoadingState label="Opening your studio" /></div>;
  if (!isSignedIn) return <div className="auth-loading"><LoadingState label="Taking you back to the studio welcome" /></div>;
  const roleValue = user?.publicMetadata?.role;
  const role = (roleValue === 'client' || roleValue === 'team_member' ? roleValue : 'agency_admin') as TeamRole;
  return <AppShell role={role}>{children}</AppShell>;
}
function SignInPage() { return <div className="auth-page"><div className="auth-story"><Link href="/" className="brand-link"><Wordmark /></Link><div><div className="eyebrow">GOOD TO HAVE YOU BACK</div><h1>Your studio<br />is waiting.</h1><p>Pick up the good ideas where you left off.</p></div><div className="auth-story-card"><AdArtwork image="/campaign-skin.jpg" headline="A little ritual. A lot of glow." accent="#e28b5b" cta="Find your ritual" /></div></div><div className="auth-card-wrap"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>; }
function SignUpPage() { return <div className="auth-page"><div className="auth-story"><Link href="/" className="brand-link"><Wordmark /></Link><div><div className="eyebrow">FOR THE PEOPLE BEHIND THE BRANDS</div><h1>Make a little<br />more <em>magic.</em></h1><p>One workspace for all your clients’ most interactive ideas.</p></div><div className="auth-story-card"><AdArtwork image="/campaign-run.jpg" headline="Find your next stride." accent="#e37654" cta="Pick your pace" /></div></div><div className="auth-card-wrap"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>; }

function DashboardPage() {
  const brandsQuery = useListBrands(); const brands = brandsQuery.data || [];
  const [brandId, setBrandId] = useState('');
  const brandParam = brandId ? Number(brandId) : undefined;
  const summaryQuery = useGetDashboard({ brandId: brandParam });
  const activityQuery = useListActivities({ brandId: brandParam });
  const adsQuery = useListAds({ brandId: brandParam });
  const summary = summaryQuery.data; const activities = activityQuery.data || []; const ads = adsQuery.data || [];
  const [location, setLocation] = useLocation();
  const featured = ads.slice(0, 3);
  return <><PageHeading eyebrow="YOUR AGENCY, AT A GLANCE" title="A good day to make something." description="Here’s what’s happening across your brands." action={<><SelectField label="Workspace brand" value={brandId} onChange={setBrandId} testId="select-dashboard-brand"><option value="">All brands</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</SelectField><Button variant="primary" onClick={() => setLocation('/ads/new')}><Plus size={16} /> New ad</Button></>} />
    {summaryQuery.isLoading ? <LoadingState /> : summaryQuery.isError ? <ErrorState retry={() => summaryQuery.refetch()} /> : <>
      <div className="stats-grid"><StatTile label="Impressions" value={formatNum(summary?.impressions)} change={summary?.impressionsChange} /><StatTile label="Interactions" value={formatNum(summary?.interactions)} change={summary?.interactionsChange} /><StatTile label="Click-through rate" value={`${(summary?.ctr || 0).toFixed(1)}%`} /><StatTile label="New leads" value={formatNum(summary?.leads)} accent /></div>
      <section className="dashboard-content"><div className="feature-column"><div className="section-head"><div><div className="eyebrow">THE WORK IN MOTION</div><h2>Ads people are playing with</h2></div><Link className="text-link" href="/ads">All ads <ArrowRight size={14} /></Link></div>
        {adsQuery.isLoading ? <LoadingState label="Collecting your latest work" /> : adsQuery.isError ? <ErrorState retry={() => adsQuery.refetch()} /> : featured.length ? <div className="dashboard-ad-list">{featured.map((ad, index) => <Link href={`/ads/${ad.id}/edit`} className="dashboard-ad" key={ad.id} data-testid={`card-dashboard-ad-${ad.id}`}><div className="mini-ad-art" style={{ backgroundImage: `linear-gradient(0deg,rgba(28,31,43,.5),transparent),url("${ad.imageUrl || (index % 2 ? '/campaign-run.jpg' : '/campaign-skin.jpg')}")` }}><span>{titleCase(ad.type)}</span></div><div className="dashboard-ad-info"><span className="eyebrow">{brands.find((brand) => brand.id === ad.brandId)?.name || 'Brand workspace'}</span><b>{ad.name}</b><span>{formatNum(ad.interactions)} interactions <span className="dot-sep">·</span> {formatNum(ad.leads)} leads</span></div><StatusPill status={ad.status} /><ArrowRight className="row-arrow" size={16} /></Link>)}</div> : <EmptyState title="Your first ad goes here" copy="Start with an interaction. The preview will keep up while you make it." action={<Button variant="primary" onClick={() => setLocation('/ads/new')}><Plus size={15} /> Create an ad</Button>} />}
      </div><aside className="activity-panel"><div className="section-head"><div><div className="eyebrow">FRESH FROM THE STUDIO</div><h2>Recent activity</h2></div><Activity size={17} /></div>{activityQuery.isLoading ? <LoadingState label="Checking in" /> : activityQuery.isError ? <ErrorState retry={() => activityQuery.refetch()} /> : activities.length ? <div className="activity-list">{activities.slice(0, 7).map((item) => <article className="activity-item" key={item.id} data-testid={`activity-${item.id}`}><i /><div><b>{item.action}</b><p>{item.target}</p><time>{shortDate(item.createdAt)}</time></div></article>)}</div> : <EmptyState title="A little quiet here" copy="Brand and campaign updates will show up here." />}</aside></section>
      <section className="brand-band"><div><span className="eyebrow">YOUR CLIENT ROSTER</span><h2>{brands.length ? `${brands.length} brands. One clear view.` : 'A home for every client.'}</h2><p>Each workspace keeps its voice, creative and momentum together.</p></div><div className="brand-chip-list">{brandsQuery.isLoading ? <LoadingState label="Loading brands" /> : brands.map((brand) => <Link href="/brands" className="brand-chip" key={brand.id} data-testid={`brand-chip-${brand.id}`}><span style={{ backgroundColor: brand.primaryColor }}>{brand.name.slice(0,1)}</span>{brand.name}<ArrowUpRight size={14} /></Link>)}<Link href="/brands" className="brand-chip add-brand-chip"><Plus size={15} /> Add brand</Link></div></section>
    </>}</>;
}

function BrandsPage() {
  const query = useListBrands(); const brands = query.data || []; const client = useQueryClient();
  const createBrand = useCreateBrand(); const updateBrand = useUpdateBrand(); const deleteBrand = useDeleteBrand();
  const [dialog, setDialog] = useState<Brand | 'new' | null>(null);
  const [name, setName] = useState(''); const [industry, setIndustry] = useState(''); const [description, setDescription] = useState('');
  const [primary, setPrimary] = useState('#d96543'); const [secondary, setSecondary] = useState('#f1d5b8');
  const openDialog = (brand: Brand | 'new') => { setDialog(brand); setName(brand === 'new' ? '' : brand.name); setIndustry(brand === 'new' ? '' : brand.industry || ''); setDescription(brand === 'new' ? '' : brand.description || ''); setPrimary(brand === 'new' ? '#d96543' : brand.primaryColor); setSecondary(brand === 'new' ? '#f1d5b8' : brand.secondaryColor); };
  const save = (event: React.FormEvent) => { event.preventDefault(); const data = { name, industry: industry || null, description: description || null, primaryColor: primary, secondaryColor: secondary };
    const onSuccess = () => { client.invalidateQueries({ queryKey: getListBrandsQueryKey() }); setDialog(null); toast.success(dialog === 'new' ? 'Brand workspace created' : 'Brand details updated'); };
    if (dialog === 'new') createBrand.mutate({ data }, { onSuccess, onError: () => toast.error('Could not create brand') });
    else if (dialog) updateBrand.mutate({ brandId: dialog.id, data }, { onSuccess, onError: () => toast.error('Could not update brand') });
  };
  const remove = (brand: Brand) => { if (!window.confirm(`Remove ${brand.name} and its workspace data?`)) return; deleteBrand.mutate({ brandId: brand.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListBrandsQueryKey() }); toast.success('Brand removed'); }, onError: () => toast.error('Could not remove brand') }); };
  return <><PageHeading eyebrow="CLIENT WORKSPACES" title="Every brand, in its element." description="A distinct home for each client’s voice, creative and social connections." action={<Button variant="primary" onClick={() => openDialog('new')}><Plus size={16} /> Add a brand</Button>} />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : brands.length ? <div className="brands-grid">{brands.map((brand, index) => <article key={brand.id} className="brand-card" data-testid={`card-brand-${brand.id}`}><div className="brand-card-cover" style={{ '--brand-color': brand.primaryColor, '--brand-secondary': brand.secondaryColor } as React.CSSProperties}><span className="brand-monogram">{brand.name.slice(0, 1)}</span><span className="brand-card-num">BRAND / {String(index + 1).padStart(2, '0')}</span><button type="button" className="brand-menu" aria-label={`Actions for ${brand.name}`} onClick={() => openDialog(brand)}><MoreHorizontal size={18} /></button></div><div className="brand-card-body"><span className="eyebrow">{brand.industry || 'Independent brand'}</span><h2>{brand.name}</h2><p>{brand.description || 'A focused workspace for good ideas and better conversations.'}</p><div className="brand-card-meta"><span className="color-swatch" style={{ background: brand.primaryColor }} /><span className="color-swatch" style={{ background: brand.secondaryColor }} /><span>Workspace colors</span></div><div className="brand-card-actions"><Button variant="outline" onClick={() => openDialog(brand)}>Edit workspace</Button><button type="button" className="icon-button danger-icon" aria-label={`Delete ${brand.name}`} onClick={() => remove(brand)} data-testid={`delete-brand-${brand.id}`}><Trash2 size={16} /></button></div></div></article>)}</div> : <EmptyState title="A blank canvas for a client." copy="Add your first brand and give their best ideas a place to land." action={<Button variant="primary" onClick={() => openDialog('new')}><Plus size={15} /> Add your first brand</Button>} />}
    {dialog && <OverlayDialog title={dialog === 'new' ? 'Create a brand workspace' : `Edit ${dialog.name}`} onClose={() => setDialog(null)}><form className="form-stack" onSubmit={save}><Input label="Brand name" value={name} onChange={setName} placeholder="e.g. Field Notes" required testId="input-brand-name" /><Input label="Industry" value={industry} onChange={setIndustry} placeholder="e.g. Skincare" testId="input-brand-industry" /><label className="field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What makes this brand unmistakable?" data-testid="input-brand-description" /></label><div className="color-fields"><label className="field"><span>Primary color</span><input type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} data-testid="input-brand-primary" /></label><label className="field"><span>Secondary color</span><input type="color" value={secondary} onChange={(event) => setSecondary(event.target.value)} data-testid="input-brand-secondary" /></label></div><div className="dialog-actions"><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={createBrand.isPending || updateBrand.isPending}>{createBrand.isPending || updateBrand.isPending ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Save workspace</Button></div></form></OverlayDialog>}</>;
}

function AdEditorPage({ edit = false }: { edit?: boolean }) {
  const params = new URLSearchParams(window.location.search); const brandQuery = useListBrands(); const brands = brandQuery.data || [];
  const [, setLocation] = useLocation(); const client = useQueryClient();
  const pathId = window.location.pathname.match(/\/ads\/(\d+)\/edit/);
  const id = edit ? Number(pathId?.[1]) : undefined;
  const adQuery = useGetAd(id || 0, { query: { enabled: edit && !!id, queryKey: ['ad-editor', id] } });
  const createAd = useCreateAd(); const updateAd = useUpdateAd();
  const [initialized, setInitialized] = useState(false);
  const [brandId, setBrandId] = useState(''); const [name, setName] = useState('');
  const [type, setType] = useState<AdType>('poll'); const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('A little moment worth sharing.'); const [cta, setCta] = useState('Find your favorite');
  const [accent, setAccent] = useState('#df7950'); const [imageUrl, setImageUrl] = useState('/campaign-skin.jpg');
  const [options, setOptions] = useState('A slow morning, A fresh start');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const ad = adQuery.data as Ad | undefined;
  useEffect(() => { if (edit && ad && !initialized) { setInitialized(true); setBrandId(String(ad.brandId)); setName(ad.name); setType(ad.type); setHeadline(ad.headline); setBody(ad.body); setCta(ad.ctaLabel); setAccent(ad.accentColor); setImageUrl(ad.imageUrl || '/campaign-skin.jpg'); setOptions(String(ad.config?.options || 'A slow morning, A fresh start')); } }, [edit, ad, initialized]);
  useEffect(() => { if (!brandId && brands.length) setBrandId(String(brands[0].id)); }, [brandId, brands]);
  const submit = (event: React.FormEvent) => { event.preventDefault(); const data = { brandId: Number(brandId), name: name.trim(), type, headline, body, ctaLabel: cta, accentColor: accent, imageUrl, config: { options: options.split(',').map((x) => x.trim()).filter(Boolean) } };
    const onSuccess = (saved: Ad) => { client.invalidateQueries({ queryKey: getListAdsQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); toast.success(edit ? 'Ad changes saved' : 'Your ad is ready'); setLocation(`/ads/${saved.id}/edit`); };
    if (edit && id) updateAd.mutate({ adId: id, data: { name: data.name, type, headline, body, ctaLabel: cta, accentColor: accent, imageUrl, config: data.config } }, { onSuccess, onError: () => toast.error('Could not save changes') });
    else createAd.mutate({ data }, { onSuccess, onError: () => toast.error('Could not create ad') });
  };
  useEffect(() => { (window as Window & { __adType?: string }).__adType = type; return () => { delete (window as Window & { __adType?: string }).__adType; }; }, [type]);
  return <><PageHeading eyebrow={edit ? 'AD STUDIO / EDIT' : 'AD STUDIO / NEW'} title={edit ? 'Give it another good pass.' : 'Make something they can play.'} description="Your preview updates as you make it. No guesswork, no separate preview tab." action={<Button variant="outline" onClick={() => setLocation('/ads')}><ArrowLeft size={15} /> Back to ads</Button>} />
    {edit && adQuery.isLoading ? <LoadingState label="Opening this ad" /> : edit && adQuery.isError ? <ErrorState retry={() => adQuery.refetch()} /> : <div className="ad-builder"><form className="builder-controls" onSubmit={submit}><div className="builder-step"><span className="step-number">01</span><div><h2>Set the scene</h2><p>Pick a brand and give your idea a name.</p></div></div><SelectField label="Brand workspace" value={brandId} onChange={setBrandId} testId="select-ad-brand"><option value="">Choose a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</SelectField><Input label="Ad name" value={name} onChange={setName} placeholder="e.g. Spring morning poll" required testId="input-ad-name" />
      <div className="builder-step step-spaced"><span className="step-number">02</span><div><h2>Choose how to play</h2><p>Each format gives people a different way in.</p></div></div><div className="ad-type-grid">{AD_TYPES.map((item) => <button key={item} type="button" className={`type-option ${type === item ? 'type-option-active' : ''}`} onClick={() => setType(item)} aria-pressed={type === item} data-testid={`type-${item}`}><span>{item === 'poll' ? 'A/B' : item === 'quiz' ? '?' : item === 'spin_wheel' ? '↻' : item === 'carousel' ? '▤' : item === 'lead_form' ? '↗' : '↔'}</span><b>{titleCase(item)}</b></button>)}</div>
      <div className="builder-step step-spaced"><span className="step-number">03</span><div><h2>Make it yours</h2><p>Words and visuals, right in place.</p></div></div><Input label="Headline" value={headline} onChange={setHeadline} placeholder="A little ritual. A lot of glow." testId="input-ad-headline" /><label className="field"><span>Supporting copy</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Give the idea a little context." data-testid="input-ad-body" /></label>
      <div className="field-image"><div><b>Visual</b><p>Choose a campaign image for the preview.</p></div><div className="image-picker"><button type="button" className={imageUrl.includes('skin') ? 'image-choice selected' : 'image-choice'} onClick={() => setImageUrl('/campaign-skin.jpg')} aria-label="Use serum campaign image" style={{ backgroundImage: "url('/campaign-skin.jpg')" }} data-testid="image-campaign-skin" /><button type="button" className={imageUrl.includes('run') ? 'image-choice selected' : 'image-choice'} onClick={() => setImageUrl('/campaign-run.jpg')} aria-label="Use city running campaign image" style={{ backgroundImage: "url('/campaign-run.jpg')" }} data-testid="image-campaign-run" /></div></div>
      <Input label="Call to action" value={cta} onChange={setCta} placeholder="Find your favorite" testId="input-ad-cta" /><label className="field"><span>Accent color</span><div className="color-control"><input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} data-testid="input-ad-accent" /><code>{accent}</code></div></label>{(type === 'poll' || type === 'quiz') && <Input label="Choices, separated by commas" value={options} onChange={setOptions} placeholder="Option one, Option two" testId="input-ad-options" />}
      <div className="builder-submit"><Button type="submit" variant="primary" disabled={createAd.isPending || updateAd.isPending || !brands.length}>{createAd.isPending || updateAd.isPending ? <LoaderCircle size={16} className="spin" /> : <Zap size={15} />}{edit ? 'Save changes' : 'Create this ad'}</Button><small>{edit ? 'Your original ad stays intact.' : 'Drafted now. Ready when you are.'}</small></div></form>
      <section className="builder-preview"><div className="preview-toolbar"><div><div className="eyebrow">LIVE PREVIEW</div><h2>It feels real already.</h2></div><div className="device-toggle" role="group" aria-label="Preview size"><button type="button" className={device === 'desktop' ? 'device-active' : ''} onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'} data-testid="preview-desktop">Desktop</button><button type="button" className={device === 'mobile' ? 'device-active' : ''} onClick={() => setDevice('mobile')} aria-pressed={device === 'mobile'} data-testid="preview-mobile">Mobile</button></div></div><div className={`preview-stage preview-${device}`}><div className="preview-ad"><AdArtwork image={imageUrl} headline={headline || 'A little ritual. A lot of glow.'} accent={accent} cta={cta || 'Find your favorite'} interactive adType={type} options={options.split(',').map((x) => x.trim()).filter(Boolean)} onAction={() => undefined} /></div></div><div className="preview-footer"><span><i /> INTERACTIVE PREVIEW</span><span>Changes appear as you type</span></div></section>
    </div>}</>;
}

function AdsPage() {
  const brandsQuery = useListBrands(); const brands = brandsQuery.data || [];
  const [search, setSearch] = useState(''); const [brandId, setBrandId] = useState(''); const [status, setStatus] = useState('');
  const params = useMemo(() => ({ ...(brandId ? { brandId: Number(brandId) } : {}), ...(search ? { search } : {}), ...(status ? { status: status as 'draft' | 'published' | 'archived' } : {}) }), [brandId, search, status]);
  const query = useListAds(params); const ads = query.data || []; const client = useQueryClient(); const deleteAd = useDeleteAd(); const updateAd = useUpdateAd();
  const [location, setLocation] = useLocation();
  const remove = (ad: Ad) => { if (!window.confirm(`Delete “${ad.name}”?`)) return; deleteAd.mutate({ adId: ad.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListAdsQueryKey() }); toast.success('Ad deleted'); }, onError: () => toast.error('Could not delete this ad') }); };
  return <><PageHeading eyebrow="THE AD LIBRARY" title="Good ideas, in progress." description="Search every interactive ad across your client brands." action={<Button variant="primary" onClick={() => setLocation('/ads/new')}><Plus size={16} /> Make an ad</Button>} /><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search by ad or headline" /><SelectField label="Brand" value={brandId} onChange={setBrandId} testId="filter-ad-brand"><option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</SelectField><SelectField label="Status" value={status} onChange={setStatus} testId="filter-ad-status"><option value="">Every status</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></SelectField><span className="results-count"><Filter size={14} /> {ads.length} results</span></div>
    {query.isLoading ? <LoadingState label="Looking through your library" /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : ads.length ? <div className="ads-grid">{ads.map((ad, index) => <article className="library-card" key={ad.id} data-testid={`card-ad-${ad.id}`}><Link href={`/ads/${ad.id}/edit`} className="library-art" style={{ backgroundImage: `linear-gradient(180deg,transparent 30%,rgba(28,31,43,.6)),url("${ad.imageUrl || (index % 2 ? '/campaign-run.jpg' : '/campaign-skin.jpg')}")` }}><span className="library-type">{titleCase(ad.type)}</span><span className="library-art-headline">{ad.headline}</span><span className="library-go"><ArrowUpRight size={16} /></span></Link><div className="library-card-body"><div className="library-title"><div><span className="eyebrow">{brands.find((b) => b.id === ad.brandId)?.name || 'Workspace'}</span><h2>{ad.name}</h2></div><button type="button" className="icon-button danger-icon" aria-label={`Delete ${ad.name}`} onClick={() => remove(ad)} data-testid={`delete-ad-${ad.id}`}><Trash2 size={15} /></button></div><div className="library-metrics"><span><Eye size={14} /> {formatNum(ad.impressions)}</span><span><Activity size={14} /> {formatNum(ad.interactions)}</span><span><Users size={14} /> {formatNum(ad.leads)}</span><label className="status-select"><span className="sr-only">Ad status</span><select aria-label={`Status for ${ad.name}`} value={ad.status} onChange={(event) => updateAd.mutate({ adId: ad.id, data: { status: event.target.value as Ad['status'] } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListAdsQueryKey() }); toast.success(`Ad ${event.target.value}`); }, onError: () => toast.error('Could not update ad status') })} data-testid={`status-ad-${ad.id}`}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div></div></article>)}</div> : <EmptyState title="No ads in this view." copy="Try a different filter, or make a new ad for this brand." action={<Button variant="primary" onClick={() => setLocation('/ads/new')}><Plus size={15} /> Make an ad</Button>} />}
  </>;
}

function PublicAdPage() {
  const slug = window.location.pathname.split('/').filter(Boolean).pop() || '';
  const query = useGetPublicAd(slug, { query: { queryKey: getGetPublicAdQueryKey(slug) } });
  const record = useRecordPublicAdEvent(); const submit = useSubmitPublicLead(); const adInfo = query.data;
  const embed = new URLSearchParams(window.location.search).get('embed') === '1';
  useEffect(() => { if (adInfo?.ad?.id) record.mutate({ slug, data: { eventType: 'view' } }); }, [adInfo?.ad?.id, slug]);
  if (query.isLoading) return <div className="public-ad-loading"><LoadingState label="Getting the experience ready" /></div>;
  if (query.isError || !adInfo) return <main className="public-ad-error"><Wordmark dark /><h1>This ad has moved on.</h1><p>The link might have expired or the ad may no longer be public.</p><Link href="/" className="button button-dark">Back to AdPilot</Link></main>;
  const { ad, brand } = adInfo;
  (window as Window & { __adType?: string }).__adType = ad.type;
  return <main className="public-experience" style={{ '--ad-accent': ad.accentColor, '--brand-primary': brand.primaryColor } as React.CSSProperties}>{!embed && <header className="public-top"><Wordmark dark /><span>AN INTERACTIVE STORY FROM <b>{brand.name}</b></span></header>}<div className="public-ad-layout"><div className="public-ad-copy"><div className="eyebrow"><span className="live-dot" /> A LITTLE SOMETHING FOR YOU</div><h1>{ad.headline}</h1><p>{ad.body}</p><div className="public-ad-meta"><span>TAKE A MOMENT</span><span>•</span><span>{titleCase(ad.type)}</span></div></div><div className="public-ad-frame"><AdArtwork image={ad.imageUrl || '/campaign-skin.jpg'} headline={ad.headline} accent={ad.accentColor} cta={ad.ctaLabel} interactive adType={ad.type} options={Array.isArray(ad.config?.options) ? (ad.config.options as unknown[]).map(String) : undefined} onAction={() => record.mutate({ slug, data: { eventType: 'interaction' } })} onEvent={(eventType, metadata) => record.mutate({ slug, data: { eventType, metadata } })} /></div></div>
    {ad.type === 'lead_form' && <form className="public-lead-form" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); submit.mutate({ slug, data: { name: String(data.get('name')), email: String(data.get('email')), phone: String(data.get('phone') || ''), consent: data.get('consent') === 'on' } }, { onSuccess: () => { toast.success('Thanks. You’re on the list.'); form.reset(); }, onError: () => toast.error('Could not send your details') }); }}><h2>Be first to know.</h2><input name="name" aria-label="Your name" placeholder="Your name" required data-testid="input-public-name" /><input name="email" type="email" aria-label="Email address" placeholder="Email address" required data-testid="input-public-email" /><label><input name="consent" type="checkbox" required /> I’m happy to hear from {brand.name}.</label><Button type="submit" variant="primary" disabled={submit.isPending}>{submit.isPending ? 'Sending…' : 'Join the list'}</Button></form>}
    {!embed && <footer className="public-footer"><span>Made with <Wordmark dark /></span><span>GOOD IDEAS SHOULD BE SHARED.</span></footer>}</main>;
}

function CalendarPage() {
  const brandsQuery = useListBrands(); const brands = brandsQuery.data || []; const adsQuery = useListAds(); const ads = adsQuery.data || [];
  const [current, setCurrent] = useState(new Date()); const [view, setView] = useState<'month' | 'week'>('month');
  const [dialog, setDialog] = useState(false); const [editingPost, setEditingPost] = useState<number | null>(null); const [brandId, setBrandId] = useState(''); const [adId, setAdId] = useState(''); const [caption, setCaption] = useState(''); const [platforms, setPlatforms] = useState<SocialPlatform[]>(['instagram']); const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const first = new Date(current.getFullYear(), current.getMonth(), 1); const monthStart = new Date(current.getFullYear(), current.getMonth(), 1 - first.getDay()); const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 7);
  const query = useListScheduledPosts({ from: monthStart.toISOString(), to: monthEnd.toISOString() }); const posts = query.data || []; const create = useCreateScheduledPost(); const update = useUpdateScheduledPost(); const remove = useDeleteScheduledPost(); const client = useQueryClient();
  const days = Array.from({ length: view === 'month' ? 42 : 7 }, (_, i) => { const day = new Date(monthStart); day.setDate(day.getDate() + i + (view === 'week' ? Math.floor((current.getDate() - 1) / 7) * 7 : 0)); return day; });
  const monthLabel = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const refresh = () => client.invalidateQueries({ queryKey: getListScheduledPostsQueryKey() });
  const savePost = (event: React.FormEvent) => { event.preventDefault(); if (!brandId) { toast.error('Choose a brand workspace first'); return; } const payload = { adId: adId ? Number(adId) : null, caption, platforms, scheduledAt: new Date(date).toISOString(), status: 'scheduled' as const }; const onSuccess = () => { refresh(); setDialog(false); setEditingPost(null); toast.success(editingPost ? 'Scheduled post updated' : 'Post added to the calendar'); }; if (editingPost) update.mutate({ postId: editingPost, data: payload }, { onSuccess, onError: () => toast.error('Could not update this post') }); else create.mutate({ data: { brandId: Number(brandId), ...payload } }, { onSuccess, onError: () => toast.error('Could not schedule this post') }); };
  const togglePlatform = (platform: SocialPlatform) => setPlatforms((values) => values.includes(platform) ? values.filter((value) => value !== platform) : [...values, platform]);
  const move = (direction: number) => setCurrent((value) => { const next = new Date(value); if (view === 'month') next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + 7 * direction); return next; });
  const startNewPost = (day?: Date) => { setEditingPost(null); setBrandId(brands[0] ? String(brands[0].id) : ''); setAdId(''); setCaption(''); setDate((day || new Date()).toISOString().slice(0,16)); setPlatforms(['instagram']); setDialog(true); };
  const editPost = (post: NonNullable<typeof posts>[number]) => { setEditingPost(post.id); setBrandId(String(post.brandId)); setAdId(post.adId ? String(post.adId) : ''); setCaption(post.caption); setDate(new Date(post.scheduledAt).toISOString().slice(0,16)); setPlatforms(post.platforms); setDialog(true); };
  return <><PageHeading eyebrow="THE PUBLISHING RHYTHM" title="Make room for good timing." description="A shared calendar for every brand and every social moment." action={<Button variant="primary" onClick={() => startNewPost()}><Plus size={16} /> Schedule a post</Button>} /><div className="calendar-toolbar"><div className="month-controls"><button type="button" className="icon-button" onClick={() => move(-1)} aria-label="Previous period"><ChevronLeft size={18} /></button><h2>{monthLabel}</h2><button type="button" className="icon-button" onClick={() => move(1)} aria-label="Next period"><ChevronRight size={18} /></button><Button variant="outline" onClick={() => setCurrent(new Date())}>Today</Button></div><div className="device-toggle"><button type="button" className={view === 'month' ? 'device-active' : ''} onClick={() => setView('month')}>Month</button><button type="button" className={view === 'week' ? 'device-active' : ''} onClick={() => setView('week')}>Week</button></div></div>
    {query.isLoading ? <LoadingState label="Laying out your schedule" /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : <div className={`calendar-grid calendar-${view}`}><div className="weekday-row">{['SUN','MON','TUE','WED','THU','FRI','SAT'].slice(0, view === 'week' ? 7 : 7).map((day) => <span key={day}>{day}</span>)}</div>{days.map((day, index) => { const dayPosts = posts.filter((post) => new Date(post.scheduledAt).toDateString() === day.toDateString()); const outside = day.getMonth() !== current.getMonth(); return <div key={`${day.toISOString()}-${index}`} className={`calendar-day ${outside ? 'calendar-outside' : ''} ${day.toDateString() === new Date().toDateString() ? 'calendar-today' : ''}`} data-testid={`calendar-day-${day.toISOString().slice(0,10)}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const postId = Number(event.dataTransfer.getData('text/plain')); const moved = posts.find((item) => item.id === postId); if (!moved) return; const next = new Date(moved.scheduledAt); next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate()); if (next.toDateString() === new Date(moved.scheduledAt).toDateString()) return; update.mutate({ postId, data: { scheduledAt: next.toISOString() } }, { onSuccess: () => { refresh(); toast.success('Post rescheduled'); }, onError: () => toast.error('Could not reschedule this post') }); }}><div className="day-head"><b>{day.getDate()}</b><button type="button" className="day-add" aria-label={`Add post on ${shortDate(day.toISOString())}`} onClick={() => startNewPost(day)}><Plus size={14} /></button></div>{dayPosts.map((post) => <article key={post.id} draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', String(post.id)); event.dataTransfer.effectAllowed = 'move'; }} className={`calendar-post post-${post.status}`} data-testid={`calendar-post-${post.id}`}><span>{post.platforms.map((platform) => platform === 'instagram' ? 'IG' : platform.slice(0, 2).toUpperCase()).join(' / ')}</span><b>{post.caption || ads.find((ad) => ad.id === post.adId)?.name || 'Social post'}</b><small>{new Date(post.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small><div className="post-actions"><button type="button" aria-label={`Edit post: ${post.caption}`} onClick={() => editPost(post)}><Settings2 size={12} /></button>{post.status !== 'published' && <button type="button" aria-label="Mark as published" onClick={() => update.mutate({ postId: post.id, data: { status: 'published' } }, { onSuccess: () => { refresh(); toast.success('Post marked published'); }, onError: () => toast.error('Could not update post') })}><Check size={12} /></button>}<button type="button" aria-label="Delete post" onClick={() => { if (window.confirm('Delete this scheduled post?')) remove.mutate({ postId: post.id }, { onSuccess: () => { refresh(); toast.success('Post deleted'); }, onError: () => toast.error('Could not delete post') }); }}><Trash2 size={12} /></button></div></article>)}</div>; })}</div>}
    {dialog && <OverlayDialog title={editingPost ? 'Update this scheduled post' : 'Put a good post on the calendar'} onClose={() => { setDialog(false); setEditingPost(null); }}><form className="form-stack" onSubmit={savePost}><SelectField label="Brand workspace" value={brandId} onChange={setBrandId} testId="select-post-brand"><option value="">Choose a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</SelectField><SelectField label="Link an ad (optional)" value={adId} onChange={setAdId} testId="select-post-ad"><option value="">No linked ad</option>{ads.map((ad) => <option key={ad.id} value={ad.id}>{ad.name}</option>)}</SelectField><label className="field"><span>Caption</span><textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="What’s the story?" required data-testid="input-post-caption" /></label><Input label="Date and time" value={date} onChange={setDate} type="datetime-local" required testId="input-post-date" /><div className="field"><span>Share to</span><div className="platform-picker">{PLATFORMS.map((platform) => <button type="button" key={platform} className={platforms.includes(platform) ? 'platform-picked' : ''} onClick={() => togglePlatform(platform)} aria-pressed={platforms.includes(platform)}>{platform}</button>)}</div></div><div className="dialog-actions"><Button variant="outline" onClick={() => { setDialog(false); setEditingPost(null); }}>Cancel</Button><Button type="submit" variant="primary" disabled={create.isPending || update.isPending}><CalendarDays size={15} /> {editingPost ? 'Save changes' : 'Schedule post'}</Button></div></form></OverlayDialog>}</>;
}

function AnalyticsPage() {
  const brandsQuery = useListBrands(); const brands = brandsQuery.data || []; const [brandId, setBrandId] = useState(''); const [range, setRange] = useState<'7d'|'30d'|'90d'>('30d');
  const params = useMemo(() => ({ range, ...(brandId ? { brandId: Number(brandId) } : {}) }), [range, brandId]);
  const query = useGetAnalytics(params); const data = query.data;
  const max = Math.max(1, ...(data?.series.map((point) => point.impressions) || [1]));
  return <><PageHeading eyebrow="THE BIG PICTURE" title="Know what’s getting a response." description="A clearer read on what people are doing with your creative." action={<SelectField label="Brand" value={brandId} onChange={setBrandId} testId="select-analytics-brand"><option value="">All brands</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</SelectField>} />
    <div className="analytics-controls"><div className="range-switch" role="group" aria-label="Analytics range">{(['7d','30d','90d'] as const).map((value) => <button key={value} type="button" className={range === value ? 'range-active' : ''} onClick={() => setRange(value)} data-testid={`analytics-range-${value}`}>{value}</button>)}</div><span><i /> LIVE FROM YOUR WORKSPACE</span></div>
    {query.isLoading ? <LoadingState label="Drawing your analytics" /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : <><section className="chart-panel"><div className="chart-heading"><div><div className="eyebrow">THE RESPONSE CURVE</div><h2>Impressions & interaction</h2></div><div className="chart-legend"><span><i /> Impressions</span><span><i /> Interactions</span></div></div><div className="bar-chart" role="img" aria-label="Impressions and interactions by date">{(data?.series || []).map((point, index) => <div className="chart-column" key={`${point.date}-${index}`} title={`${shortDate(point.date)}: ${formatNum(point.impressions)} impressions, ${formatNum(point.interactions)} interactions`}><div className="bar-stack"><i style={{ height: `${Math.max(4, point.interactions / max * 100)}%` }} /><b style={{ height: `${Math.max(5, point.impressions / max * 100)}%` }} /></div><span>{shortDate(point.date)}</span></div>)}</div></section><section className="analytics-lower"><div className="panel-card"><div className="section-head"><div><div className="eyebrow">WORKING HARDER</div><h2>Top ads</h2></div><WandSparkles size={17} /></div>{data?.topAds?.length ? data.topAds.map((ad,index) => <div className="top-ad-row" key={ad.id}><span className="top-rank">{String(index + 1).padStart(2, '0')}</span><div><b>{ad.name}</b><small>{titleCase(ad.type)} · {formatNum(ad.impressions)} impressions</small></div><strong>{ad.ctr.toFixed(1)}% <small>CTR</small></strong></div>) : <EmptyState title="No top ads yet" copy="Once creative gets a response, the standouts will show up here." />}</div><div className="panel-card"><div className="section-head"><div><div className="eyebrow">WHERE IT HAPPENS</div><h2>Platform mix</h2></div><Activity size={17} /></div>{data?.platforms?.length ? <div className="platform-rows">{data.platforms.map((platform) => { const maxPlatform = Math.max(1, ...data.platforms.map((item) => item.impressions)); return <div className="platform-row" key={platform.platform}><div><b>{titleCase(platform.platform)}</b><span>{formatNum(platform.interactions)} interactions</span></div><div className="platform-bar"><i style={{ width: `${platform.impressions / maxPlatform * 100}%` }} /></div><strong>{formatNum(platform.impressions)}</strong></div>; })}</div> : <EmptyState title="No platform activity" copy="Connect an account and start sharing your interactive work." />}</div></section></>}
  </>;
}

function LeadsPage() {
  const brandsQuery = useListBrands(); const brands = brandsQuery.data || []; const [brandId, setBrandId] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const params = useMemo(() => ({ ...(brandId ? { brandId: Number(brandId) } : {}), ...(search ? { search } : {}), page, pageSize: 12 }), [brandId, search, page]);
  const query = useListLeads(params); const data = query.data;
  const exportCsv = () => { const items = data?.items || []; const rows = [['Name','Email','Phone','Brand ID','Ad ID','Consent','Created at'], ...items.map((lead) => [lead.name, lead.email, lead.phone || '', String(lead.brandId), String(lead.adId), lead.consent ? 'Yes' : 'No', lead.createdAt])]; const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"','""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = 'adpilot-leads.csv'; link.click(); URL.revokeObjectURL(url); toast.success('CSV downloaded'); };
  useEffect(() => setPage(1), [brandId, search]);
  return <><PageHeading eyebrow="PEOPLE WHO RAISED A HAND" title="A good conversation starts here." description="Every lead from your interactive ads, ready for the right brand team." action={<Button variant="outline" onClick={exportCsv} disabled={!data?.items.length}><Download size={16} /> Export CSV</Button>} /><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search by name or email" /><SelectField label="Brand" value={brandId} onChange={setBrandId} testId="filter-leads-brand"><option value="">All brands</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</SelectField><span className="results-count"><Users size={14} /> {data?.total ?? 0} people</span></div>
    {query.isLoading ? <LoadingState label="Finding your leads" /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : data?.items.length ? <><div className="table-wrap"><table className="data-table"><thead><tr><th>PERSON</th><th>BRAND / AD</th><th>PHONE</th><th>CONSENT</th><th>JOINED</th></tr></thead><tbody>{data.items.map((lead) => <tr key={lead.id} data-testid={`lead-row-${lead.id}`}><td><div className="lead-person"><span>{lead.name.slice(0,1).toUpperCase()}</span><div><b>{lead.name}</b><small>{lead.email}</small></div></div></td><td><b>{brands.find((brand) => brand.id === lead.brandId)?.name || `Brand ${lead.brandId}`}</b><small className="table-subline">Ad #{lead.adId}</small></td><td>{lead.phone || '—'}</td><td><span className={`consent ${lead.consent ? 'consent-yes' : ''}`}>{lead.consent ? 'Yes' : 'No'}</span></td><td>{shortDate(lead.createdAt)}</td></tr>)}</tbody></table></div><div className="pagination"><span>Page {data.page} of {data.totalPages} <em>· {data.total} leads</em></span><div><Button variant="outline" disabled={data.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /> Previous</Button><Button variant="outline" disabled={data.page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight size={15} /></Button></div></div></> : <EmptyState title="The next good conversation is out there." copy="When someone shares their details through a lead ad, they’ll land here." />}
  </>;
}

function SocialPage() {
  const brandsQuery = useListBrands(); const brands = brandsQuery.data || []; const [brandId, setBrandId] = useState(''); const activeBrand = Number(brandId || brands[0]?.id || 0);
  useEffect(() => { if (!brandId && brands.length) setBrandId(String(brands[0].id)); }, [brandId, brands]);
  const query = useListSocialAccounts(activeBrand, { query: { enabled: !!activeBrand, queryKey: getListSocialAccountsQueryKey(activeBrand) } }); const accounts = query.data || [];
  const connect = useConnectSocialAccount(); const disconnect = useDisconnectSocialAccount(); const client = useQueryClient();
  const activePlatforms = new Set(accounts.filter((account) => account.status === 'connected').map((account) => account.platform));
  const connectTo = (platform: SocialPlatform) => { if (!activeBrand) { toast.error('Create a brand workspace first'); return; } connect.mutate({ brandId: activeBrand, data: { platform, handle: `@${(brands.find((brand) => brand.id === activeBrand)?.name || 'brand').toLowerCase().replaceAll(' ', '')}` } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListSocialAccountsQueryKey(activeBrand) }); toast.success(`${titleCase(platform)} connected`); }, onError: () => toast.error(`Could not connect ${titleCase(platform)}`) }); };
  const disconnectAccount = (id: number) => { if (!window.confirm('Disconnect this social account?')) return; disconnect.mutate({ accountId: id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListSocialAccountsQueryKey(activeBrand) }); toast.success('Account disconnected'); }, onError: () => toast.error('Could not disconnect account') }); };
  return <><PageHeading eyebrow="SOCIAL PRESENCE" title="The channels behind each brand." description="Connect accounts to keep publishing in step with the work." action={<SelectField label="Brand workspace" value={String(activeBrand || '')} onChange={setBrandId} testId="select-social-brand"><option value="">Choose a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</SelectField>} />
    <div className="social-intro"><div className="social-mark"><Link2 size={20} /></div><div><h2>{brands.find((brand) => brand.id === activeBrand)?.name || 'Your brand'} channels</h2><p>Each connection stays scoped to this workspace.</p></div><span className="connected-count">{accounts.filter((account) => account.status === 'connected').length} connected</span></div>
    {query.isLoading ? <LoadingState label="Checking social connections" /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : <div className="social-list">{PLATFORMS.map((platform) => { const account = accounts.find((item) => item.platform === platform && item.status === 'connected'); return <article className="social-card" key={platform} data-testid={`social-${platform}`}><div className={`social-platform-logo social-${platform}`}>{platform === 'instagram' ? <Instagram size={19} /> : platform === 'facebook' ? 'f' : platform === 'linkedin' ? 'in' : 'X'}</div><div className="social-account-info"><h3>{titleCase(platform)}</h3>{account ? <p>{account.handle} <span>·</span> {formatNum(account.followers)} followers</p> : <p>Share your brand’s interactive work here.</p>}</div>{account ? <><span className="social-connected"><i /> Connected</span><Button variant="outline" onClick={() => disconnectAccount(account.id)}>Disconnect</Button></> : <Button variant="dark" disabled={!activeBrand || connect.isPending} onClick={() => connectTo(platform)}><Plus size={14} /> Connect</Button>}</article>; })}</div>}
    <div className="social-footnote"><CircleHelp size={16} /><p>Connecting uses AdPilot’s mock social adapter in this workspace. No third-party sign-in or account permissions are requested.</p></div>
  </>;
}

function TeamPage() {
  const query = useListTeamMembers(); const members = query.data || []; const brandsQuery = useListBrands(); const brands = brandsQuery.data || [];
  const invite = useInviteTeamMember(); const update = useUpdateTeamMember(); const remove = useRemoveTeamMember(); const client = useQueryClient();
  const [showInvite, setShowInvite] = useState(false); const [email, setEmail] = useState(''); const [role, setRole] = useState<TeamRole>('team_member'); const [brandIds, setBrandIds] = useState<number[]>([]);
  const [location, setLocation] = useLocation(); const [, setPath] = useLocation();
  const refresh = () => client.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
  const submitInvite = (event: React.FormEvent) => { event.preventDefault(); invite.mutate({ data: { email, role, brandIds } }, { onSuccess: () => { refresh(); setShowInvite(false); setEmail(''); setBrandIds([]); toast.success('Invitation sent'); }, onError: () => toast.error('Could not invite this person') }); };
  const toggleBrand = (id: number) => setBrandIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const updateRole = (memberId: number, nextRole: TeamRole) => update.mutate({ memberId, data: { role: nextRole } }, { onSuccess: refresh, onError: () => toast.error('Could not update role') });
  const deleteMember = (memberId: number) => { if (!window.confirm('Remove this teammate from your studio?')) return; remove.mutate({ memberId }, { onSuccess: () => { refresh(); toast.success('Teammate removed'); }, onError: () => toast.error('Could not remove teammate') }); };
  return <><PageHeading eyebrow="THE PEOPLE WHO MAKE IT HAPPEN" title="Good work is a team sport." description="Invite collaborators, set their role and give them the right brand workspaces." action={<Button variant="primary" onClick={() => setShowInvite(true)}><Plus size={16} /> Invite a teammate</Button>} />
    <div className="team-callout"><div className="team-callout-icon"><Users size={19} /></div><div><b>{members.length} in your studio</b><span>Roles decide what each person can see. Brand access keeps client work in the right hands.</span></div><span className="role-note">AGENCY ADMIN · FULL ACCESS</span></div>
    {query.isLoading ? <LoadingState label="Gathering the team" /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : members.length ? <div className="table-wrap"><table className="data-table team-table"><thead><tr><th>TEAMMATE</th><th>ROLE</th><th>BRAND ACCESS</th><th>STATUS</th><th /></tr></thead><tbody>{members.map((member) => <tr key={member.id} data-testid={`team-row-${member.id}`}><td><div className="lead-person"><span>{(member.name || member.email).slice(0,1).toUpperCase()}</span><div><b>{member.name || 'Invitation pending'}</b><small>{member.email}</small></div></div></td><td><select aria-label={`Role for ${member.email}`} value={member.role} onChange={(event) => updateRole(member.id, event.target.value as TeamRole)} data-testid={`team-role-${member.id}`}><option value="agency_admin">Agency admin</option><option value="team_member">Team member</option><option value="client">Client</option></select></td><td><div className="team-brand-tags">{member.brandIds.length ? member.brandIds.map((id) => <span key={id}>{brands.find((brand) => brand.id === id)?.name || `Brand ${id}`}</span>) : <span>All brands</span>}</div></td><td><StatusPill status={member.status} /></td><td><button type="button" className="icon-button danger-icon" aria-label={`Remove ${member.email}`} onClick={() => deleteMember(member.id)} data-testid={`remove-team-${member.id}`}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="Better together." copy="Invite the people making the work happen and give them the right client access." action={<Button variant="primary" onClick={() => setShowInvite(true)}><Plus size={15} /> Invite a teammate</Button>} />}
    {showInvite && <OverlayDialog title="Bring someone into the studio" onClose={() => setShowInvite(false)}><form className="form-stack" onSubmit={submitInvite}><Input label="Work email" value={email} onChange={setEmail} type="email" placeholder="hello@yourstudio.com" required testId="input-invite-email" /><SelectField label="Workspace role" value={role} onChange={(value) => setRole(value as TeamRole)} testId="select-invite-role"><option value="team_member">Team member</option><option value="client">Client</option><option value="agency_admin">Agency admin</option></SelectField><div className="field"><span>Brand access</span><div className="brand-checkboxes">{brands.map((brand) => <label key={brand.id}><input type="checkbox" checked={brandIds.includes(brand.id)} onChange={() => toggleBrand(brand.id)} /> {brand.name}</label>)}{!brands.length && <small>Add a brand workspace first.</small>}</div></div><div className="dialog-actions"><Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={invite.isPending}><Send size={15} /> Send invite</Button></div></form></OverlayDialog>}</>;
}

function HomeRedirect() { return <Landing />; }
function RouteFrame({ children }: { children: React.ReactNode }) { return <SecureWorkspace>{children}</SecureWorkspace>; }
function NotFound() { return <main className="not-found"><Wordmark dark /><div className="eyebrow">404 / LOST IN THE STUDIO</div><h1>This page isn’t in the brief.</h1><p>Let’s get you back to the work.</p><Link className="button button-dark" href="/dashboard">Back to your workspace <ArrowRight size={15} /></Link></main>; }
function RouterContent() {
  const [, setLocation] = useLocation();
  return <>
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/ad/:slug" component={PublicAdPage} />
      <Route path="/dashboard"><RouteFrame><DashboardPage /></RouteFrame></Route>
      <Route path="/brands"><RouteFrame><BrandsPage /></RouteFrame></Route>
      <Route path="/ads"><RouteFrame><AdsPage /></RouteFrame></Route>
      <Route path="/ads/new"><RouteFrame><AdEditorPage /></RouteFrame></Route>
      <Route path="/ads/:id/edit"><RouteFrame><AdEditorPage edit /></RouteFrame></Route>
      <Route path="/calendar"><RouteFrame><CalendarPage /></RouteFrame></Route>
      <Route path="/analytics"><RouteFrame><AnalyticsPage /></RouteFrame></Route>
      <Route path="/leads"><RouteFrame><LeadsPage /></RouteFrame></Route>
      <Route path="/social"><RouteFrame><SocialPage /></RouteFrame></Route>
      <Route path="/team"><RouteFrame><TeamPage /></RouteFrame></Route>
      <Route component={NotFound} />
    </Switch>
  </>;
}
function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const userRef = useMemo(() => ({ id: undefined as string | null | undefined }), []);
  useEffect(() => addListener(({ user }) => { const id = user?.id ?? null; if (userRef.id !== undefined && userRef.id !== id) client.clear(); userRef.id = id; }), [addListener, client, userRef]);
  return null;
}
function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Your studio is just around the corner.' } }, signUp: { start: { title: 'Start making things move', subtitle: 'One good idea can change the whole scroll.' } } }} routerPush={(path) => setLocation(stripBase(path))} routerReplace={(path) => setLocation(stripBase(path), { replace: true })}><ClerkCacheInvalidator /><RouterContent /></ClerkProvider>;
}
function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><ClerkRoutes /></WouterRouter><Toaster richColors position="top-right" /></QueryClientProvider>;
}
export default App;
