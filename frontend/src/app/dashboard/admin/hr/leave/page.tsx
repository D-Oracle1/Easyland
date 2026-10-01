'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatTile, toneFromClass } from '@/components/dashboard/stat-tile';

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  createdAt: string;
  rejectionReason: string | null;
  staffProfile: {
    id: string;
    annualLeaveBalance: number;
    sickLeaveBalance: number;
    user: { firstName: string; lastName: string; avatar: string | null };
    department: { name: string } | null;
  };
}

const LEAVE_TYPES = ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'COMPASSIONATE', 'UNPAID', 'STUDY'];

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getLeaveTypeLabel = (type: string) => {
  return type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ');
};

export default function AdminLeavePage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const res: any = await api.get(`/hr/leave?${params.toString()}`);
      const data = res?.data?.data || res?.data || [];
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch leave requests:', err);
      toast.error(err.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (request: LeaveRequest) => {
    setActionLoading(request.id);
    try {
      await api.put(`/hr/leave/${request.id}/approve`, {});
      toast.success('Leave request approved');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve request');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setActionLoading(selectedRequest.id);
    try {
      await api.put(`/hr/leave/${selectedRequest.id}/reject`, { reason: rejectReason.trim() });
      toast.success('Leave request rejected');
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request');
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate stats
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  const stats = [
    { label: 'Pending', value: pendingCount, color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock },
    { label: 'Approved', value: approvedCount, color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2 },
    { label: 'Rejected', value: rejectedCount, color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
    { label: 'Total Requests', value: requests.length, color: 'text-blue-600', bg: 'bg-blue-100', icon: CalendarDays },
  ];

  // Filter by search
  const filteredRequests = requests.filter((request) => {
    if (!searchQuery) return true;
    const name = `${request.staffProfile?.user?.firstName || ''} ${request.staffProfile?.user?.lastName || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader title={"Leave Management"} description={"Review and manage staff leave requests"} />
        <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat: any, index: number) => (
          <StatTile
            key={stat.label}
            index={index}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            tone={toneFromClass(stat.color)}
            featured={index === 0}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Leave Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {LEAVE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{getLeaveTypeLabel(type)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Leave Requests
              <Badge variant="secondary">{filteredRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No leave requests found</p>
              </div>
            ) : (
              filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-10 h-10">
                        {request.staffProfile?.user?.avatar && (
                          <AvatarImage src={getImageUrl(request.staffProfile.user.avatar)} />
                        )}
                        <AvatarFallback className="bg-primary text-white">
                          {request.staffProfile?.user?.firstName?.[0] || ''}
                          {request.staffProfile?.user?.lastName?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">
                            {request.staffProfile?.user?.firstName} {request.staffProfile?.user?.lastName}
                          </p>
                          <Badge variant="outline">{request.staffProfile?.department?.name || 'No Dept'}</Badge>
                        </div>
                        <div className="text-sm flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{getLeaveTypeLabel(request.type)}</Badge>
                          <span>{formatDate(request.startDate)} to {formatDate(request.endDate)} ({request.totalDays} days)</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{request.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Applied: {formatDate(request.createdAt)}
                          {request.type === 'ANNUAL' && request.staffProfile?.annualLeaveBalance !== undefined && (
                            <> &bull; Balance: {request.staffProfile.annualLeaveBalance} days</>
                          )}
                          {request.type === 'SICK' && request.staffProfile?.sickLeaveBalance !== undefined && (
                            <> &bull; Balance: {request.staffProfile.sickLeaveBalance} days</>
                          )}
                        </p>
                        {request.status === 'REJECTED' && request.rejectionReason && (
                          <p className="text-sm text-red-600 mt-2">
                            <XCircle className="w-4 h-4 inline mr-1" />
                            {request.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 md:flex-col lg:flex-row items-start">
                      {request.status === 'PENDING' ? (
                        <>
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => handleApprove(request)}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1"
                            onClick={() => openRejectDialog(request)}
                            disabled={actionLoading === request.id}
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </Button>
                        </>
                      ) : (
                        <Badge
                          className={
                            request.status === 'APPROVED'
                              ? 'bg-green-100 text-green-700'
                              : request.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : ''
                          }
                        >
                          {request.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this leave request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Reason for Rejection *</Label>
            <Textarea
              id="reason"
              placeholder="Enter the reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading === selectedRequest?.id}
            >
              {actionLoading === selectedRequest?.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
