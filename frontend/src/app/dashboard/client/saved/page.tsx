'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Bookmark } from 'lucide-react';
import PostCard, { PostData } from '@/components/engagement/post-card';
import PostDetailDialog from '@/components/engagement/post-detail-dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';

interface SavedPostItem extends PostData {
  savedAt: string;
}

interface SavedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function SavedPostsPage() {
  const [posts, setPosts] = useState<SavedPostItem[]>([]);
  const [meta, setMeta] = useState<SavedMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchSaved = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '10' });
      const res = await api.get<{ data: SavedPostItem[]; meta: SavedMeta }>(
        `/engagement/saved?${params}`
      );
      const newPosts = (res.data || []).map((p) => ({
        ...p,
        userReaction: p.userReaction ?? null,
        isSaved: true,
      }));
      const newMeta = res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };
      setPosts((prev) => (append ? [...prev, ...newPosts] : newPosts));
      setMeta(newMeta);
    } catch {
      toast.error('Failed to load saved posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchSaved(1, false);
  }, [fetchSaved]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSaved(nextPage, true);
  };

  const handleReact = async (postId: string, type: string) => {
    try {
      const res = await api.post<any>(`/engagement/feed/${postId}/react`, { type });
      const data = res?.data ?? res;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const wasRemove = data.action === 'removed';
          const newReaction = wasRemove ? null : type;
          const reactionCount = wasRemove
            ? Math.max(0, p.reactionCount - 1)
            : p.userReaction
            ? p.reactionCount
            : p.reactionCount + 1;
          return { ...p, userReaction: newReaction, reactionCount };
        })
      );
    } catch {
      toast.error('Failed to react');
    }
  };

  const handleSave = async (postId: string) => {
    try {
      await api.post(`/engagement/feed/${postId}/save`);
      // Remove from saved list immediately since toggling off
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      toast.success('Post removed from saved');
    } catch {
      toast.error('Failed to unsave post');
    }
  };

  const handleOpenDetail = (postId: string) => {
    setDetailPostId(postId);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={"Saved Posts"} description={"Posts you've bookmarked for later"} />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading saved posts...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground font-medium">No saved posts yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Browse the feed and bookmark posts you want to revisit.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/dashboard/client/feed">Browse Feed</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{meta.total} saved post{meta.total !== 1 ? 's' : ''}</p>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onReact={handleReact}
              onSave={handleSave}
              onOpenDetail={handleOpenDetail}
            />
          ))}
          {page < meta.totalPages && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      <PostDetailDialog
        postId={detailPostId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
