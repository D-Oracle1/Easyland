'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Newspaper, Sparkles } from 'lucide-react';
import PostCard, { PostData } from '@/components/engagement/post-card';
import TrendingSidebar from '@/components/engagement/trending-sidebar';
import PostDetailDialog from '@/components/engagement/post-detail-dialog';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POST_TYPES = [
  { value: 'ALL', label: 'All', gradient: 'from-gray-600 to-gray-500' },
  { value: 'ANNOUNCEMENT', label: 'Announcements', gradient: 'from-blue-500 to-blue-400' },
  { value: 'PRODUCT_UPDATE', label: 'Updates', gradient: 'from-purple-500 to-violet-400' },
  { value: 'EDUCATIONAL_TIP', label: 'Tips', gradient: 'from-emerald-500 to-green-400' },
  { value: 'EVENT', label: 'Events', gradient: 'from-orange-500 to-amber-400' },
  { value: 'POLL', label: 'Polls', gradient: 'from-cyan-500 to-sky-400' },
  { value: 'CASE_STUDY', label: 'Case Studies', gradient: 'from-indigo-500 to-blue-400' },
  { value: 'SPONSORED_FEATURE', label: 'Featured', gradient: 'from-pink-500 to-rose-400' },
];

interface FeedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EngagementFeedPage() {
  const [posts, setPosts] = useState<PostData[]>([]);
  const postsRef = useRef<PostData[]>([]);
  const [meta, setMeta] = useState<FeedMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<PostData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchPosts = useCallback(async (pageNum: number, type: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '10' });
      if (type !== 'ALL') params.set('type', type);
      const res = await api.get<{ data: PostData[]; meta: FeedMeta }>(`/engagement/feed?${params}`);
      const newPosts = res.data || [];
      const newMeta = res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };
      setPosts((prev) => {
        const updated = append ? [...prev, ...newPosts] : newPosts;
        postsRef.current = updated;
        return updated;
      });
      setMeta(newMeta);
    } catch {
      toast.error('Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchPosts(1, typeFilter, false);
  }, [typeFilter, fetchPosts]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, typeFilter, true);
  };

  const handleReact = useCallback(async (postId: string, type: string) => {
    // Optimistic update — apply immediately, rollback on failure
    let snapshot: PostData | undefined;
    setPosts((prev) => {
      snapshot = prev.find((p) => p.id === postId);
      return prev.map((p) => {
        if (p.id !== postId) return p;
        const toggleOff = p.userReaction === type;
        return {
          ...p,
          userReaction: toggleOff ? null : type,
          reactionCount: toggleOff
            ? Math.max(0, p.reactionCount - 1)
            : p.userReaction ? p.reactionCount : p.reactionCount + 1,
        };
      });
    });
    try {
      await api.post(`/engagement/feed/${postId}/react`, { type });
    } catch {
      if (snapshot) {
        const rollback = snapshot;
        setPosts((prev) => prev.map((p) => (p.id === postId ? rollback : p)));
      }
      toast.error('Failed to react');
    }
  }, []);

  const handleSave = useCallback(async (postId: string) => {
    // Optimistic toggle
    let prevSaved: boolean | undefined;
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      prevSaved = p.isSaved;
      return { ...p, isSaved: !p.isSaved };
    }));
    try {
      const res = await api.post<any>(`/engagement/feed/${postId}/save`);
      const data = res?.data ?? res;
      toast.success(data.saved ? 'Post saved' : 'Post unsaved');
    } catch {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isSaved: !!prevSaved } : p)));
      toast.error('Failed to save post');
    }
  }, []);

  const handleOpenDetail = useCallback((postId: string) => {
    setDetailPostId(postId);
    setDetailPost(postsRef.current.find((p) => p.id === postId) ?? null);
    setDetailOpen(true);
  }, []);

  const handleShare = useCallback(async (postId: string) => {
    try {
      await api.post(`/engagement/feed/${postId}/share`);
      toast.success('Shared internally');
    } catch {
      toast.error('Failed to share');
    }
  }, []);

  const activeType = POST_TYPES.find((t) => t.value === typeFilter) ?? POST_TYPES[0];

  return (
    <div className="space-y-5">
      {/* Gradient header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary-800 to-brand-deep p-5 sm:p-6 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 opacity-80" />
            <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Company Feed</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">What&apos;s happening</h1>
          <p className="text-sm opacity-75 mt-0.5">
            {meta.total > 0 ? `${meta.total} posts · Stay up to date` : 'Stay up to date with the latest updates'}
          </p>
        </div>
        {/* Decorative blobs */}
        <div className="absolute -right-6 -top-6 w-36 h-36 bg-white/10 rounded-full blur-sm" />
        <div className="absolute -right-2 bottom-0 w-20 h-20 bg-white/5 rounded-full" />
        <div className="absolute right-20 -top-4 w-12 h-12 bg-white/10 rounded-full" />
      </div>

      <div className="flex gap-5 items-start">
        {/* Main feed */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Pill filter tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            {POST_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={cn(
                  'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  typeFilter === t.value
                    ? `bg-gradient-to-r ${t.gradient} text-white shadow-md scale-105`
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-primary/40 hover:text-primary'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Posts */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className={cn('w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-md', activeType.gradient)}>
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
              <p className="text-sm text-muted-foreground">Loading your feed…</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center shadow-inner">
                <Newspaper className="w-8 h-8 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700 dark:text-gray-300">Nothing here yet</p>
                <p className="text-sm text-muted-foreground mt-1">Check back soon for updates</p>
              </div>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReact={handleReact}
                  onSave={handleSave}
                  onOpenDetail={handleOpenDetail}
                  onShare={handleShare}
                />
              ))}

              {page < meta.totalPages && (
                <div className="flex justify-center pt-3">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className={cn(
                      'relative overflow-hidden px-8 py-2.5 rounded-full text-sm font-semibold',
                      'bg-gradient-to-r from-primary via-primary-800 to-brand-deep text-white shadow-md',
                      'hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200',
                      loadingMore && 'opacity-70 cursor-not-allowed scale-100'
                    )}
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading…
                      </span>
                    ) : (
                      'Load more posts'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Trending sidebar */}
        <div className="hidden lg:block w-72 shrink-0">
          <TrendingSidebar />
        </div>
      </div>

      <PostDetailDialog
        postId={detailPostId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        preloadedPost={detailPost ?? undefined}
      />
    </div>
  );
}
