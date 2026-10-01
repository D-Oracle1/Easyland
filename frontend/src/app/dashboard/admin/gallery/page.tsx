'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Image as ImageIcon,
  Video,
  Upload,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Pencil,
  X,
  Film,
  Camera,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/page-header';

type GalleryItemType = 'PHOTO' | 'VIDEO';

interface GalleryItem {
  id: string;
  title?: string;
  description?: string;
  type: GalleryItemType;
  url: string;
  thumbnailUrl?: string;
  order: number;
  isPublished: boolean;
  createdAt: string;
}

const FILTER_TABS = [
  { id: 'ALL', label: 'All', icon: ImageIcon },
  { id: 'PHOTO', label: 'Photos', icon: Camera },
  { id: 'VIDEO', label: 'Videos', icon: Film },
];

export default function GalleryAdminPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | GalleryItemType>('ALL');
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = filter !== 'ALL' ? `?type=${filter}` : '';
      const res = await api.get<any>(`/gallery${typeParam}`);
      const data = res?.data !== undefined ? res.data : res;
      const list = Array.isArray(data) ? data : data?.items || [];
      setItems(list);
    } catch {
      toast.error('Failed to load gallery items');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleUpload = async (type: GalleryItemType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = type === 'PHOTO' ? 'image/*' : 'video/mp4,video/webm,video/quicktime';
    input.onchange = async (e: any) => {
      const files: File[] = Array.from(e.target.files || []);
      if (!files.length) return;

      setUploading(true);
      try {
        const endpoint = type === 'PHOTO' ? '/upload/gallery-images' : '/upload/gallery-videos';
        const fieldName = type === 'PHOTO' ? 'images' : 'videos';
        const urls = await api.uploadFiles(endpoint, files, fieldName);

        // Create gallery items for each uploaded file
        for (const url of urls) {
          await api.post('/gallery', {
            type,
            url,
            title: '',
            isPublished: true,
          });
        }

        toast.success(`${files.length} ${type.toLowerCase()}(s) uploaded`);
        fetchItems();
      } catch {
        toast.error('Failed to upload files');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleTogglePublish = async (item: GalleryItem) => {
    try {
      await api.patch(`/gallery/${item.id}/toggle-publish`);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isPublished: !i.isPublished } : i)),
      );
      toast.success(item.isPublished ? 'Item unpublished' : 'Item published');
    } catch {
      toast.error('Failed to update publish status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this gallery item?')) return;
    try {
      await api.delete(`/gallery/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('Item deleted');
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    const updated = [...items];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setItems(updated);

    try {
      await api.put('/gallery/reorder', updated.map((item, i) => ({ id: item.id, order: i })));
    } catch {
      toast.error('Failed to reorder');
      fetchItems();
    }
  };

  const openEdit = (item: GalleryItem) => {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditDescription(item.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await api.put(`/gallery/${editingItem.id}`, {
        title: editTitle,
        description: editDescription,
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id ? { ...i, title: editTitle, description: editDescription } : i,
        ),
      );
      setEditingItem(null);
      toast.success('Item updated');
    } catch {
      toast.error('Failed to update item');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title={"Gallery Management"} description={"Manage photos and videos for the public gallery"} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleUpload('PHOTO')} disabled={uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Camera className="w-4 h-4 mr-2" />
            )}
            Upload Photos
          </Button>
          <Button onClick={() => handleUpload('VIDEO')} variant="outline" disabled={uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Film className="w-4 h-4 mr-2" />
            )}
            Upload Videos
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={filter === tab.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(tab.id as any)}
            >
              <Icon className="w-4 h-4 mr-1" />
              {tab.label}
              {tab.id === 'ALL' && <Badge variant="secondary" className="ml-2">{items.length}</Badge>}
            </Button>
          );
        })}
      </div>

      {/* Gallery grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No gallery items yet</h3>
            <p className="text-muted-foreground mb-4">Upload photos or videos to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, idx) => (
            <Card
              key={item.id}
              className={cn(
                'overflow-hidden group relative',
                !item.isPublished && 'opacity-60',
              )}
            >
              <div className="aspect-square relative bg-muted">
                {item.type === 'PHOTO' ? (
                  <img
                    src={getImageUrl(item.url)}
                    alt={item.title || 'Gallery photo'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                    <video
                      src={getImageUrl(item.url)}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                        <Video className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => handleTogglePublish(item)}
                  >
                    {item.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:bg-white/20"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Badges */}
                <div className="absolute top-2 left-2 flex gap-1">
                  <Badge variant={item.type === 'PHOTO' ? 'default' : 'secondary'} className="text-xs">
                    {item.type === 'PHOTO' ? <Camera className="w-3 h-3 mr-1" /> : <Film className="w-3 h-3 mr-1" />}
                    {item.type}
                  </Badge>
                  {!item.isPublished && (
                    <Badge variant="outline" className="text-xs bg-yellow-500/80 text-white border-0">
                      Draft
                    </Badge>
                  )}
                </div>
              </div>

              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {item.title || 'Untitled'}
                    </p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === 0}
                      onClick={() => handleReorder(item.id, 'up')}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === items.length - 1}
                      onClick={() => handleReorder(item.id, 'down')}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setEditingItem(null)}>
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Gallery Item</h3>
              <Button variant="ghost" size="icon" onClick={() => setEditingItem(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter title"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
