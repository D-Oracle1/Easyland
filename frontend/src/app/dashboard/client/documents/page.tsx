'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  Download,
  Eye,
  Upload,
  Folder,
  File,
  Image,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import { StatTile, toneFromClass } from '@/components/dashboard/stat-tile';

const categories = ['All', 'Contracts', 'Deeds', 'Inspections', 'Insurance', 'Media', 'Tax'];

const getFileIcon = (type: string) => {
  switch (type) {
    case 'PDF': return <FileText className="w-8 h-8 text-red-500" />;
    case 'ZIP': return <Folder className="w-8 h-8 text-yellow-500" />;
    case 'IMG': return <Image className="w-8 h-8 text-blue-500" />;
    default: return <File className="w-8 h-8 text-gray-500" />;
  }
};

export default function ClientDocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [documents, setDocuments] = useState<any[]>([]);

  const fetchDocuments = useCallback(async () => {
    try {
      const response: any = await api.get('/documents?limit=50');
      const payload = response.data || response;
      const records = Array.isArray(payload) ? payload : payload?.data || [];
      const mapped = records.map((d: any) => ({
        id: d.id,
        name: d.name || d.title || 'Document',
        type: (d.fileType || d.type || 'PDF').toUpperCase(),
        size: d.size || '',
        property: d.property?.title || '',
        category: d.category || 'General',
        uploadDate: d.createdAt ? new Date(d.createdAt).toISOString().split('T')[0] : '',
        status: d.status || 'UPLOADED',
      }));
      setDocuments(mapped);
    } catch {
      // API unavailable, show empty state
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const totalDocs = documents.length;
  const contractCount = documents.filter(d => d.category === 'Contracts').length;
  const pendingCount = documents.filter(d => d.status === 'PENDING').length;

  const stats = [
    { title: 'Total Documents', value: String(totalDocs), icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { title: 'Contracts', value: String(contractCount), icon: File, color: 'text-green-600', bgColor: 'bg-green-100' },
    { title: 'Pending Review', value: String(pendingCount), icon: FileText, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    { title: 'Total Files', value: String(totalDocs), icon: Folder, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  ];

  const filteredDocuments = documents.filter((doc: any) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.property.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat: any, index: number) => (
          <StatTile
            key={stat.title}
            index={index}
            label={stat.title}
            value={stat.value}
            icon={stat.icon}
            tone={toneFromClass(stat.color)}
            featured={index === 0}
          />
        ))}
      </div>

      {/* Documents List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              My Documents
            </CardTitle>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  className="pl-9 w-full md:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 border rounded-md text-sm"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-4 font-medium">Document</th>
                    <th className="pb-4 font-medium">Property</th>
                    <th className="pb-4 font-medium">Category</th>
                    <th className="pb-4 font-medium">Size</th>
                    <th className="pb-4 font-medium">Date</th>
                    <th className="pb-4 font-medium">Status</th>
                    <th className="pb-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            {getFileIcon(doc.type)}
                          </div>
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-sm">{doc.property}</td>
                      <td className="py-4">
                        <Badge variant="outline">{doc.category}</Badge>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">{doc.size}</td>
                      <td className="py-4 text-sm text-muted-foreground">{formatDate(doc.uploadDate)}</td>
                      <td className="py-4">
                        <Badge variant="success">{doc.status}</Badge>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
