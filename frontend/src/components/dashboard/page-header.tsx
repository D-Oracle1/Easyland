'use client';

import { motion } from 'framer-motion';
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  FileText,
  Gift,
  Hash,
  Heart,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  MessageSquare,
  Receipt,
  Settings,
  Share2,
  Shield,
  Star,
  Target,
  Trophy,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';

type IconType = React.ComponentType<{ className?: string }>;

// First matching keyword in the title picks the header icon
const ICON_KEYWORDS: [RegExp, IconType][] = [
  [/setting/i, Settings],
  [/referral/i, Share2],
  [/leave|holiday|calendar|event/i, CalendarDays],
  [/attendance|clock|time/i, Clock],
  [/payroll|payslip|salary|wallet|earning|commission|expense|income|cash|ledger|accounting|financ/i, Wallet],
  [/tax|receipt|invoice/i, Receipt],
  [/rank|award|leaderboard|raffle/i, Trophy],
  [/review|performance|target|goal/i, Target],
  [/task|todo/i, CheckSquare],
  [/polic|document|file|report/i, FileText],
  [/notification|alert/i, Bell],
  [/chat|message|support/i, MessageSquare],
  [/channel/i, Hash],
  [/newsletter|mail/i, Mail],
  [/gallery|image|photo|media/i, ImageIcon],
  [/cms|page|content|engagement|feed|post/i, LayoutTemplate],
  [/analytic|insight|stat|overview/i, BarChart3],
  [/audit|security|permission/i, Shield],
  [/staff|employee|hr\b|team|department/i, UserCog],
  [/client|customer|lead|crm/i, Briefcase],
  [/user|realtor|people|member/i, Users],
  [/saved|favou?rite|wishlist/i, Heart],
  [/offer|deal/i, Gift],
  [/propert|listing|land|estate|branch/i, Building2],
  [/home|my /i, Home],
  [/log|history|activit/i, ClipboardList],
  [/rating|star/i, Star],
];

function iconForTitle(title: string): IconType {
  return ICON_KEYWORDS.find(([re]) => re.test(title))?.[1] ?? LayoutDashboard;
}

/**
 * Standard page header for dashboard pages: brand icon chip, title,
 * one-line description and optional right-aligned actions. The icon is picked
 * from the title when not given.
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: IconType;
  actions?: React.ReactNode;
}) {
  const Icon = icon ?? iconForTitle(title);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-800 text-white shadow-md shadow-primary/20">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
