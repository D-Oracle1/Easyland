'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ThumbsUp,
  Lightbulb,
  Rocket,
  Bookmark,
  Eye,
  Send,
  Trash2,
  Loader2,
  ExternalLink,
  Video,
  MessageSquareOff,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api, getImageUrl } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import { toast } from 'sonner';
import { timeAgo } from './post-card';
import type { PostData } from './post-card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Author {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: Author;
  parentId?: string | null;
  replies?: Comment[];
}

interface FullPost {
  id: string;
  title: string;
  content: string;
  type: string;
  mediaUrl?: string;
  mediaType?: string;
  externalLink?: string;
  isPinned: boolean;
  publishedAt: string;
  commentsDisabled?: boolean;
  author: Author;
  userReaction: string | null;
  isSaved: boolean;
  reactionCount: number;
  commentCount: number;
  viewCount: number;
  reactionBreakdown?: { HELPFUL: number; INSIGHTFUL: number; GAME_CHANGER: number };
  comments?: Comment[];
}

export interface PostDetailDialogProps {
  postId: string | null;
  open: boolean;
  onClose: () => void;
  /** Pre-populate with feed card data so the modal opens instantly */
  preloadedPost?: PostData;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REACTIONS = [
  { type: 'HELPFUL', icon: ThumbsUp, label: 'Helpful', activeColor: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  { type: 'INSIGHTFUL', icon: Lightbulb, label: 'Insightful', activeColor: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
  { type: 'GAME_CHANGER', icon: Rocket, label: 'Game Changer', activeColor: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30' },
] as const;

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  ANNOUNCEMENT: { label: 'Announcement', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  PRODUCT_UPDATE: { label: 'Product Update', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  EDUCATIONAL_TIP: { label: 'Educational Tip', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  EVENT: { label: 'Event', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  POLL: { label: 'Poll', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  CASE_STUDY: { label: 'Case Study', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  SPONSORED_FEATURE: { label: 'Sponsored Feature', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Convert basic PostData (from feed) to a partial FullPost so we can show content immediately */
function seedFromPreloaded(p: PostData): FullPost {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    type: p.type,
    mediaUrl: p.mediaUrl,
    mediaType: p.mediaType,
    externalLink: p.externalLink,
    isPinned: p.isPinned,
    publishedAt: p.publishedAt,
    commentsDisabled: false,
    author: p.author,
    userReaction: p.userReaction,
    isSaved: p.isSaved,
    reactionCount: p.reactionCount,
    commentCount: p.commentCount,
    viewCount: p.viewCount,
    comments: undefined, // will load separately
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CommentSkeleton() {
  return (
    <div className="flex gap-2.5 py-2.5 animate-pulse">
      <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  postId,
  depth,
  onReply,
  onDelete,
}: {
  comment: Comment;
  currentUserId: string | undefined;
  postId: string;
  depth: number;
  onReply: (parentId: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const isOwn = currentUserId === comment.user.id;
  return (
    <div className={cn('group', depth > 0 && 'ml-6 sm:ml-10')}>
      <div className="flex gap-2.5 py-2.5">
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          {comment.user.avatar && (
            <AvatarImage src={getImageUrl(comment.user.avatar)} alt={comment.user.firstName} />
          )}
          <AvatarFallback className="bg-muted text-[10px] font-semibold">
            {getInitials(comment.user.firstName, comment.user.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{comment.user.firstName} {comment.user.lastName}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1">
            {depth === 0 && (
              <button
                onClick={() => onReply(comment.id)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Reply
              </button>
            )}
            {isOwn && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="border-l-2 border-muted">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              postId={postId}
              depth={depth + 1}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PostDetailDialog({ postId, open, onClose, preloadedPost }: PostDetailDialogProps) {
  const currentUser = getUser();

  // post starts populated immediately if we have preloaded data
  const [post, setPost] = useState<FullPost | null>(
    preloadedPost && open ? seedFromPreloaded(preloadedPost) : null
  );
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchPost = useCallback(async () => {
    if (!postId) return;

    // If preloaded data available → show content immediately, only wait for comments
    if (preloadedPost) {
      setPost(seedFromPreloaded(preloadedPost));
    }

    setCommentsLoading(true);
    try {
      const res = await api.get<any>(`/engagement/feed/${postId}`);
      const data = res?.data ?? res;
      setPost(data);
    } catch {
      if (!preloadedPost) {
        toast.error('Failed to load post');
        onClose();
      }
      // If we had preloaded data, keep showing it even if full fetch failed
    } finally {
      setCommentsLoading(false);
    }
  }, [postId, preloadedPost, onClose]);

  useEffect(() => {
    if (open && postId) {
      fetchPost();
    }
    if (!open) {
      setPost(null);
      setCommentText('');
      setReplyTo(null);
    }
  }, [open, postId, fetchPost]);

  // When preloadedPost changes (different post selected) before dialog closes
  useEffect(() => {
    if (open && preloadedPost) {
      setPost(seedFromPreloaded(preloadedPost));
    }
  }, [preloadedPost, open]);

  // ---- Handlers ----

  const handleReact = async (type: string) => {
    if (!post) return;
    try {
      const res = await api.post<any>(`/engagement/feed/${post.id}/react`, { type });
      const data = res?.data ?? res;
      setPost((prev) => {
        if (!prev) return prev;
        const wasRemove = data.action === 'removed';
        const newReaction = wasRemove ? null : type;
        const breakdown = { ...prev.reactionBreakdown } as Record<string, number>;
        if (prev.userReaction && breakdown[prev.userReaction] !== undefined) {
          breakdown[prev.userReaction] = Math.max(0, (breakdown[prev.userReaction] || 0) - 1);
        }
        if (!wasRemove) breakdown[type] = (breakdown[type] || 0) + 1;
        const totalReactions = Object.values(breakdown).reduce((a, b) => a + b, 0);
        return { ...prev, userReaction: newReaction, reactionCount: totalReactions, reactionBreakdown: breakdown as any };
      });
    } catch {
      toast.error('Failed to react');
    }
  };

  const handleSave = async () => {
    if (!post) return;
    try {
      const res = await api.post<any>(`/engagement/feed/${post.id}/save`);
      const data = res?.data ?? res;
      setPost((prev) => (prev ? { ...prev, isSaved: data.saved } : prev));
      toast.success(data.saved ? 'Post saved' : 'Post unsaved');
    } catch {
      toast.error('Failed to save post');
    }
  };

  const handleComment = async () => {
    if (!post || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const body: { content: string; parentId?: string } = { content: commentText.trim() };
      if (replyTo) body.parentId = replyTo;
      const res = await api.post<any>(`/engagement/feed/${post.id}/comment`, body);
      const newComment: Comment = res?.data ?? res;
      setPost((prev) => {
        if (!prev) return prev;
        let comments = [...(prev.comments || [])];
        if (replyTo) {
          comments = comments.map((c) =>
            c.id === replyTo ? { ...c, replies: [...(c.replies || []), newComment] } : c
          );
        } else {
          comments = [...comments, newComment];
        }
        return { ...prev, comments, commentCount: prev.commentCount + 1 };
      });
      setCommentText('');
      setReplyTo(null);
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!post) return;
    try {
      await api.delete(`/engagement/feed/${post.id}/comment/${commentId}`);
      setPost((prev) => {
        if (!prev) return prev;
        const comments = (prev.comments || [])
          .filter((c) => c.id !== commentId)
          .map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) }));
        return { ...prev, comments, commentCount: Math.max(0, prev.commentCount - 1) };
      });
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  const handleCtaClick = async () => {
    if (!post?.externalLink) return;
    try { await api.post(`/engagement/feed/${post.id}/cta-click`); } catch { /* silent */ }
    window.open(post.externalLink, '_blank', 'noopener,noreferrer');
  };

  const replyParentAuthor = replyTo
    ? (post?.comments || []).find((c) => c.id === replyTo)?.user
    : null;

  const typeConfig = post
    ? TYPE_CONFIG[post.type] || { label: post.type.replace(/_/g, ' '), className: 'bg-gray-100 text-gray-700' }
    : null;

  const breakdown = post?.reactionBreakdown;

  // ---- Render ----

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0" aria-describedby={undefined}>

        {/* Full spinner only when no data at all */}
        {!post ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Loading post</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : (
          <>
            {/* ── Header: author FIRST, then title ── */}
            <DialogHeader className="px-5 pt-5 pb-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                {/* Author (name + avatar) comes first */}
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
                    <p className="text-sm font-semibold leading-none">
                      {post.author.firstName} {post.author.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(post.publishedAt)}</p>
                  </div>
                </div>
                {/* Type badge */}
                {typeConfig && (
                  <Badge className={cn('border-0 text-[11px] shrink-0', typeConfig.className)}>
                    {typeConfig.label}
                  </Badge>
                )}
              </div>

              {/* Title comes AFTER author */}
              <DialogTitle className="text-xl leading-snug">{post.title}</DialogTitle>
            </DialogHeader>

            {/* ── Body ── */}
            <div className="pt-4 pb-2">
              {/* Full-width media — natural ratio */}
              {post.mediaUrl && (
                <div className="mb-0">
                  {post.mediaType?.startsWith('video') ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 bg-gray-100 dark:bg-gray-800">
                      <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-md">
                        <Video className="h-7 w-7 text-gray-400" />
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">Video content</p>
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(post.mediaUrl)}
                      alt={post.title}
                      className="w-full h-auto block"
                    />
                  )}
                </div>
              )}

              {/* Full content */}
              <div className="px-5 pt-4">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none mb-4"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />

                {/* CTA */}
                {post.externalLink && (
                  <button
                    onClick={handleCtaClick}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/25 hover:border-primary/60 rounded-full px-3.5 py-1.5 transition-all duration-200 hover:bg-primary/5 mb-4"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Learn More
                  </button>
                )}

                {/* Reaction breakdown */}
                {breakdown && (
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3 pb-3 border-b">
                    {REACTIONS.map(({ type, icon: Icon, label }) => {
                      const count = (breakdown as any)[type] || 0;
                      return (
                        <div key={type} className="flex items-center gap-1">
                          <Icon className="h-3.5 w-3.5" />
                          <span>{label} {count}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-1 ml-auto">
                      <Eye className="h-3.5 w-3.5" />
                      <span>{post.viewCount} views</span>
                    </div>
                  </div>
                )}

                {/* Reaction + save buttons */}
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-0.5">
                    {REACTIONS.map(({ type, icon: Icon, label, activeColor }) => (
                      <button
                        key={type}
                        onClick={() => handleReact(type)}
                        className={cn(
                          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium',
                          'transition-all duration-200 hover:scale-105 active:scale-95',
                          post.userReaction === type
                            ? activeColor
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                        title={label}
                      >
                        <Icon className={cn('h-3.5 w-3.5', post.userReaction === type && 'fill-current')} />
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleSave}
                    className={cn(
                      'inline-flex items-center h-8 px-2.5 rounded-xl text-xs transition-all duration-200',
                      post.isSaved ? 'text-primary hover:bg-primary/5' : 'text-muted-foreground hover:bg-muted'
                    )}
                    title={post.isSaved ? 'Unsave' : 'Save'}
                  >
                    <Bookmark className={cn('h-3.5 w-3.5', post.isSaved && 'fill-current')} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Comments section ── */}
            <div className="px-5 pb-5">
              <h4 className="text-sm font-semibold mb-3">
                Comments{post.commentCount > 0 ? ` (${post.commentCount})` : ''}
              </h4>

              {post.commentsDisabled ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                  <MessageSquareOff className="h-4 w-4" />
                  <span>Comments are disabled for this post</span>
                </div>
              ) : (
                <>
                  {/* Comments list — skeleton while loading */}
                  <div className="space-y-1 mb-4 max-h-80 overflow-y-auto">
                    {commentsLoading && !post.comments ? (
                      <>
                        <CommentSkeleton />
                        <CommentSkeleton />
                        <CommentSkeleton />
                      </>
                    ) : (post.comments || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No comments yet. Be the first to share your thoughts.
                      </p>
                    ) : (
                      (post.comments || []).map((comment) => (
                        <CommentItem
                          key={comment.id}
                          comment={comment}
                          currentUserId={currentUser?.id}
                          postId={post.id}
                          depth={0}
                          onReply={setReplyTo}
                          onDelete={handleDeleteComment}
                        />
                      ))
                    )}
                  </div>

                  {/* Reply indicator */}
                  {replyTo && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span>
                        Replying to{' '}
                        <span className="font-medium text-foreground">
                          {replyParentAuthor
                            ? `${replyParentAuthor.firstName} ${replyParentAuthor.lastName}`
                            : 'comment'}
                        </span>
                      </span>
                      <button onClick={() => setReplyTo(null)} className="underline hover:text-foreground">
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Comment input */}
                  <div className="flex gap-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={replyTo ? 'Write a reply…' : 'Write a comment…'}
                      className="min-h-[60px] resize-none text-sm rounded-xl"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleComment();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-10 w-10 shrink-0 self-end rounded-xl bg-gradient-to-br from-primary via-primary-800 to-brand-deep"
                      disabled={!commentText.trim() || submitting}
                      onClick={handleComment}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
