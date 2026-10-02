'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Search,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  Download,
  MoreVertical,
  Folder,
  Eye,
  Trash2,
  Clock,
  Loader2,
  RefreshCw,
  X,
  User,
  Globe,
  Building,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, authFetch } from '@/lib/api';
import { hasSession, getUser } from '@/lib/auth-storage';
import { toast } from 'sonner';
import { PageHeader } from '@/components/dashboard/page-header';

interface SharedFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedById: string;
  channelId: string | null;
  departmentId: string | null;
  isPublic: boolean;
  createdAt: string;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  } | null;
  department: { id: string; name: string } | null;
}

interface FileSummary {
  personal: { count: number };
  department: { count: number };
  public: { count: number };
  totalSize: number;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  )
    return <FileSpreadsheet className="w-8 h-8 text-green-500" />;
  if (mimeType.startsWith('image/')) return <FileImage className="w-8 h-8 text-blue-500" />;
  if (mimeType.includes('word') || mimeType.includes('document'))
    return <FileText className="w-8 h-8 text-blue-600" />;
  return <File className="w-8 h-8 text-gray-500" />;
}

export default function FilesPage() {
  const currentUser = getUser();
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [summary, setSummary] = useState<FileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadIsPublic, setUploadIsPublic] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SharedFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFiles = useCallback(
    async (search?: string, category?: string | null) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        params.set('limit', '100');
        const queryStr = params.toString();
        const res: any = await api.get(
          `/shared-files${queryStr ? '?' + queryStr : ''}`,
        );
        const data = res?.data || [];
        setFiles(Array.isArray(data) ? data : []);
      } catch {
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchSummary = useCallback(async () => {
    try {
      const res: any = await api.get('/shared-files/summary');
      setSummary(res?.data || res);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchSummary();
  }, [fetchFiles, fetchSummary]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchFiles(searchQuery || undefined, activeCategory);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, activeCategory, fetchFiles]);

  const handleCategoryClick = (category: string) => {
    setActiveCategory((prev) => (prev === category ? null : category));
  };

  // Upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append('files', f));
      if (uploadIsPublic) formData.append('isPublic', 'true');

      const token = hasSession();
      const response = await authFetch(`${api.baseUrl}/shared-files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message || 'Upload failed');
      }

      toast.success(
        `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} uploaded successfully`,
      );
      setUploadOpen(false);
      setSelectedFiles([]);
      setUploadIsPublic(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFiles(searchQuery || undefined, activeCategory);
      fetchSummary();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/shared-files/${deleteTarget.id}`);
      toast.success('File deleted');
      setDeleteTarget(null);
      fetchFiles(searchQuery || undefined, activeCategory);
      fetchSummary();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete file');
    } finally {
      setDeleting(false);
    }
  };

  // Download
  const handleDownload = (file: SharedFile) => {
    window.open(file.url, '_blank');
  };

  // Folder cards
  const folders = [
    {
      id: 'personal',
      name: 'My Files',
      count: summary?.personal.count ?? 0,
      color: 'bg-blue-500',
      icon: User,
    },
    {
      id: 'department',
      name: 'Department Files',
      count: summary?.department.count ?? 0,
      color: 'bg-green-500',
      icon: Building,
    },
    {
      id: 'public',
      name: 'Public Files',
      count: summary?.public.count ?? 0,
      color: 'bg-purple-500',
      icon: Globe,
    },
  ];

  if (loading && files.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <PageHeader title={"Shared Files"} />
          <p className="text-muted-foreground">
            Access and manage team files and documents
            {summary ? ` (${formatFileSize(summary.totalSize)} total)` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              fetchFiles(searchQuery || undefined, activeCategory);
              fetchSummary();
            }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4" />
            Upload File
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search files..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Folders / Categories */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Categories</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {folders.map((folder, index) => (
            <motion.div
              key={folder.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={`hover:shadow-lg transition-shadow cursor-pointer ${
                  activeCategory === folder.id
                    ? 'ring-2 ring-primary border-primary'
                    : ''
                }`}
                onClick={() => handleCategoryClick(folder.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${folder.color} flex items-center justify-center`}
                    >
                      <folder.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{folder.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {folder.count} file{folder.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {activeCategory === folder.id && (
                      <Badge className="bg-primary/10 text-primary text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Files List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {activeCategory
                ? `${folders.find((f) => f.id === activeCategory)?.name || 'Files'}`
                : 'All Files'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No files found</p>
                <p className="text-sm">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'Upload a file to get started'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((file) => {
                  const uploaderName = file.uploadedBy
                    ? `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`
                    : 'Unknown';
                  const isOwner = file.uploadedById === currentUser?.id;

                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{uploaderName}</span>
                          <span>&bull;</span>
                          <span>{formatDate(file.createdAt)}</span>
                          <span>&bull;</span>
                          <span>{formatFileSize(file.size)}</span>
                          {file.department && (
                            <>
                              <span>&bull;</span>
                              <Badge variant="secondary" className="text-xs">
                                {file.department.name}
                              </Badge>
                            </>
                          )}
                          {file.isPublic && (
                            <>
                              <span>&bull;</span>
                              <Badge
                                variant="secondary"
                                className="text-xs bg-purple-100 text-purple-700"
                              >
                                Public
                              </Badge>
                            </>
                          )}
                          {isOwner && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-blue-100 text-blue-700"
                            >
                              Mine
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(file)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload(file)}>
                              <Download className="w-4 h-4 mr-2" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => window.open(file.url, '_blank')}
                            >
                              <Eye className="w-4 h-4 mr-2" /> Preview
                            </DropdownMenuItem>
                            {isOwner && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setDeleteTarget(file)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Select files to share with your team
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="files">Select Files</Label>
              <Input
                id="files"
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
              />
              {selectedFiles.length > 0 && (
                <div className="space-y-1">
                  {selectedFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded"
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="text-muted-foreground ml-2 shrink-0">
                        {formatFileSize(f.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isPublic"
                type="checkbox"
                checked={uploadIsPublic}
                onChange={(e) => setUploadIsPublic(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isPublic" className="text-sm font-normal cursor-pointer">
                Make files public (visible to all staff)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                setSelectedFiles([]);
                setUploadIsPublic(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
            >
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
