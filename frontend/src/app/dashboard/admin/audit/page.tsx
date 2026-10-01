'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    entity: '',
    action: '',
    page: 1,
    limit: 25,
  });

  const queryParams = new URLSearchParams();
  if (filters.entity) queryParams.set('entity', filters.entity);
  if (filters.action) queryParams.set('action', filters.action);
  queryParams.set('page', String(filters.page));
  queryParams.set('limit', String(filters.limit));

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => api.get(`/audit?${queryParams.toString()}`),
  });

  const logs = data?.data?.data || data?.data || [];
  const meta = data?.data?.meta || data?.meta || { page: 1, totalPages: 1, total: 0 };

  const clearFilters = () => {
    setFilters({ entity: '', action: '', page: 1, limit: 25 });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Track all system changes and user actions" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter audit logs by entity or action type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full sm:w-48">
              <label className="text-sm font-medium mb-1 block">Entity</label>
              <Select
                value={filters.entity}
                onValueChange={(value) =>
                  setFilters({ ...filters, entity: value === 'all' ? '' : value, page: 1 })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="properties">Properties</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="commission">Commission</SelectItem>
                  <SelectItem value="cms">CMS</SelectItem>
                  <SelectItem value="gallery">Gallery</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-48">
              <label className="text-sm font-medium mb-1 block">Action</label>
              <Select
                value={filters.action}
                onValueChange={(value) =>
                  setFilters({ ...filters, action: value === 'all' ? '' : value, page: 1 })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(filters.entity || filters.action) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {log.user?.firstName} {log.user?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{log.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={ACTION_COLORS[log.action] || ''}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-sm">{log.entity}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.entityId?.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ipAddress || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
