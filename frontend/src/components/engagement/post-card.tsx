'use client';

import React, { useState } from 'react';
import {
  Pin,
  ThumbsUp,
  Lightbulb,
  Rocket,
  MessageSquare,
  Bookmark,
  Eye,
  ExternalLink,
  Video,
  Share2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { api, getImageUrl } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostAuthor {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface PostData {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  type: string;
  mediaUrl?: string;
  mediaType?: string;
  externalLink?: string;
  isPinned: boolean;
  publishedAt: string;
  author: PostAuthor;
  userReaction: string | null;
  isSaved: boolean;
  reactionCount: number;
  commentCount: number;
  viewCount: number;
}

export interface PostCardProps {
  post: PostData;
  onReact: (postId: string, type: string) => void;
  onSave: (postId: string) => void;
  onOpenDetail: (postId: string) => void;
  onShare?: (postId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<string, { label: string; badge: string; accent: string }> = {
  ANNOUNCEMENT: {
    label: 'Announcement',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    accent: 'from-blue-500 to-blue-400',
  },
  PRODUCT_UPDATE: {
    label: 'Product Update',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    accent: 'from-purple-500 to-violet-400',
  },
  EDUCATIONAL_TIP: {
    label: 'Educational Tip',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    accent: 'from-emerald-500 to-green-400',
  },
  EVENT: {
    label: 'Event',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    accent: 'from-orange-500 to-amber-400',
  },
  POLL: {
    label: 'Poll',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    accent: 'from-cyan-500 to-sky-400',
  },
  CASE_STUDY: {
    label: 'Case Study',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    accent: 'from-indigo-500 to-blue-400',
  },
  SPONSORED_FEATURE: {
    label: 'Sponsored Feature',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    accent: 'from-pink-500 to-rose-400',
  },
};

const REACTIONS = [
  {
    type: 'HELPFUL',
    icon: ThumbsUp,
    label: 'Helpful',
    activeColor: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
    countColor: 'text-blue-500',
  },
  {
    type: 'INSIGHTFUL',
    icon: Lightbulb,
    label: 'Insightful',
    activeColor: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',
    countColor: 'text-amber-500',
  },
  {
    type: 'GAME_CHANGER',
    icon: Rocket,
    label: 'Game Changer',
    activeColor: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30',
    countColor: 'text-rose-500',
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PostCard({ post, onReact, onSave, onOpenDetail, onShare }: PostCardProps) {
  const [ctaLoading, setCtaLoading] = useState(false);

  const config = TYPE_CONFIG[post.type] ?? {
    label: post.type.replace(/_/g, ' '),
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    accent: 'from-gray-400 to-gray-500',
  };

  const hasImage = !!post.mediaUrl;
  const isVideo = post.mediaType?.startsWith('video');
  const excerptText = stripHtml(post.excerpt || post.content);

  const handleCtaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.externalLink) return;
    // Open immediately for instant feel, track click in background
    window.open(post.externalLink, '_blank', 'noopener,noreferrer');
    setCtaLoading(true);
    api.post(`/engagement/feed/${post.id}/cta-click`).catch(() => {}).finally(() => setCtaLoading(false));
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;
    onOpenDetail(post.id);
  };

  return (
    <div
      className="group bg-white dark:bg-gray-900 rounded-2xl overflow-hidden cursor-pointer
        shadow-[0_1px_4px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
        border border-gray-100 dark:border-gray-800/80
        transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5"
      onClick={handleCardClick}
    >
      {/* Gradient accent strip */}
      <div className={cn('h-[3px] w-full bg-gradient-to-r', config.accent)} />

      {/* Header: pinned + author + type */}
      <div className="px-4 pt-3.5">
        {post.isPinned && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-semibold mb-2.5 bg-amber-50 dark:bg-amber-900/20 w-fit px-2 py-1 rounded-full">
            <Pin className="h-3 w-3" />
            Pinned
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-white dark:ring-gray-900 shadow-sm">
              {post.author.avatar && (
                <AvatarImage src={getImageUrl(post.author.avatar)} alt={post.author.firstName} />
              )}
              <AvatarFallback className="bg-gradient-to-br from-primary via-primary-800 to-brand-deep text-white text-xs font-bold">
                {getInitials(post.author.firstName, post.author.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none truncate text-gray-900 dark:text-white">
                {post.author.firstName} {post.author.lastName}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(post.publishedAt)}</p>
            </div>
          </div>
          <span className={cn('shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full', config.badge)}>
            {config.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-bold leading-snug mt-3 text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">
          {post.title}
        </h3>

        {/* Excerpt — right after title, before the image */}
        {excerptText && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-3 leading-relaxed">
            {excerptText}
          </p>
        )}
      </div>

      {/* Media — rounded, with side padding so corners are visible */}
      {hasImage && (
        <div className="mt-3 px-4">
          <div className="rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-800/50">
            {isVideo ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 bg-gray-100 dark:bg-gray-800">
                <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-md">
                  <Video className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-xs text-gray-400 font-medium">Video content · click to view</p>
              </div>
            ) : (
              <img
                src={getImageUrl(post.mediaUrl!)}
                alt={post.title}
                className="w-full h-auto block"
                loading="lazy"
              />
            )}
          </div>
        </div>
      )}

      {/* CTA link */}
      {post.externalLink && (
        <div className="px-4 pt-2">
          <button
            onClick={handleCtaClick}
            disabled={ctaLoading}
            className={cn(
              'inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary',
              'border border-primary/25 hover:border-primary/60 rounded-full px-3.5 py-1.5',
              'transition-all duration-200 hover:bg-primary/5 hover:shadow-sm',
              ctaLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <ExternalLink className="h-3 w-3" />
            Learn More
          </button>
        </div>
      )}

      {/* Reaction + comment counts row */}
      {(post.reactionCount > 0 || post.commentCount > 0) && (
        <div className="px-4 pt-3 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {post.reactionCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1">
                {REACTIONS.slice(0, 3).map((r) => (
                  <span
                    key={r.type}
                    className="inline-flex items-center justify-center w-4.5 h-4.5 rounded-full bg-white dark:bg-gray-800 shadow-sm ring-1 ring-white dark:ring-gray-900"
                  >
                    <r.icon className={cn('h-2.5 w-2.5', r.countColor)} />
                  </span>
                ))}
              </div>
              <span>{post.reactionCount} {post.reactionCount === 1 ? 'reaction' : 'reactions'}</span>
            </div>
          )}
          {post.commentCount > 0 && (
            <span className="ml-auto flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
            </span>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 mt-2.5 border-t border-gray-100 dark:border-gray-800" />

      {/* Action bar */}
      <div className="px-2 py-1.5 flex items-center justify-between">
        {/* Reaction buttons */}
        <div className="flex items-center gap-0">
          {REACTIONS.map(({ type, icon: Icon, label, activeColor }) => (
            <button
              key={type}
              onClick={(e) => { e.stopPropagation(); onReact(post.id, type); }}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium',
                'transition-all duration-200 hover:scale-105 active:scale-95 select-none',
                post.userReaction === type
                  ? activeColor
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
              title={label}
            >
              <Icon className={cn('h-4 w-4', post.userReaction === type && 'fill-current')} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Secondary: comment, save, share, views */}
        <div className="flex items-center gap-0">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDetail(post.id); }}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs text-gray-400 hover:text-primary hover:bg-primary/5 transition-all duration-200"
            title="View comments"
          >
            <MessageSquare className="h-4 w-4" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onSave(post.id); }}
            className={cn(
              'inline-flex items-center h-8 px-2.5 rounded-xl text-xs',
              'transition-all duration-200 hover:scale-110 active:scale-95',
              post.isSaved
                ? 'text-primary hover:bg-primary/5'
                : 'text-gray-400 hover:text-primary hover:bg-primary/5'
            )}
            title={post.isSaved ? 'Unsave' : 'Save'}
          >
            <Bookmark className={cn('h-4 w-4', post.isSaved && 'fill-current')} />
          </button>

          {onShare && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(post.id); }}
              className="inline-flex items-center h-8 px-2.5 rounded-xl text-xs text-gray-400 hover:text-primary hover:bg-primary/5 transition-all duration-200"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-center gap-1 px-2 text-xs text-gray-300 dark:text-gray-600">
            <Eye className="h-3.5 w-3.5" />
            <span>{post.viewCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(PostCard, (prev, next) =>
  prev.post.id === next.post.id &&
  prev.post.userReaction === next.post.userReaction &&
  prev.post.isSaved === next.post.isSaved &&
  prev.post.reactionCount === next.post.reactionCount &&
  prev.post.commentCount === next.post.commentCount &&
  prev.post.viewCount === next.post.viewCount
);
