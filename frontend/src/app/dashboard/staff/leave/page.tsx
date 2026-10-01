'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Palmtree,
  Stethoscope,
  Baby,
  Heart,
  Loader2,
  RefreshCw,
  BookOpen,
  CircleDollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';

interface LeaveBalance {
  annual: { total: number; used: number; remaining: number };
  sick: { total: number; used: number; remaining: number };
  other: {
    maternity: number;
    paternity: number;
    compassionate: number;
    unpaid: number;
    study: number;
  };
}

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  staffProfile?: {
    user: { firstName: string; lastName: string };
    manager?: { user: { firstName: string; lastName: string } } | null;
  };
}

const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'Annual Leave', icon: Palmtree, color: 'text-green-600', bg: 'bg-green-100' },
  { value: 'SICK', label: 'Sick Leave', icon: Stethoscope, color: 'text-red-600', bg: 'bg-red-100' },
  { value: 'MATERNITY', label: 'Maternity Leave', icon: Baby, color: 'text-blue-600', bg: 'bg-blue-100' },
  { value: 'PATERNITY', label: 'Paternity Leave', icon: Baby, color: 'text-cyan-600', bg: 'bg-cyan-100' },
  { value: 'COMPASSIONATE', label: 'Compassionate Leave', icon: Heart, color: 'text-purple-600', bg: 'bg-purple-100' },
  { value: 'UNPAID', label: 'Unpaid Leave', icon: CircleDollarSign, color: 'text-gray-600', bg: 'bg-gray-100' },
  { value: 'STUDY', label: 'Study Leave', icon: BookOpen, color: 'text-yellow-600', bg: 'bg-yellow-100' },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING':
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    case 'APPROVED':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Approved
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1">
          <XCircle className="w-3 h-3" />
          Rejected
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 gap-1">
          <XCircle className="w-3 h-3" />
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function LeavePage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  // Form state
  const [formType, setFormType] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [balanceRes, requestsRes] = await Promise.allSettled([
        api.get<any>('/hr/leave/balance'),
        api.get<any>('/hr/leave'),
      ]);

      if (balanceRes.status === 'fulfilled') {
        const data = balanceRes.value?.data || balanceRes.value;
        setBalance(data);
      }

      if (requestsRes.status === 'fulfilled') {
        const data = requestsRes.value?.data?.data || requestsRes.value?.data || [];
        setRequests(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      console.error('Failed to fetch leave data:', err);
      toast.error(err.message || 'Failed to load leave data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormType('');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');
  };

  const handleSubmit = async () => {
    if (!formType || !formStartDate || !formEndDate || !formReason.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (new Date(formEndDate) < new Date(formStartDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setActionLoading('submit');
    try {
      await api.post('/hr/leave', {
        type: formType,
        startDate: formStartDate,
        endDate: formEndDate,
        reason: formReason.trim(),
      });
      toast.success('Leave request submitted successfully!');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit leave request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    setActionLoading(requestId);
    try {
      await api.delete(`/hr/leave/${requestId}`);
      toast.success('Leave request cancelled successfully!');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel leave request');
    } finally {
      setActionLoading(null);
    }
  };

  // Build leave balance cards
  const leaveBalances = balance
    ? [
        {
          type: 'Annual',
          used: balance.annual.used,
          total: balance.annual.total,
          remaining: balance.annual.remaining,
          icon: Palmtree,
          color: 'text-green-600',
          bg: 'bg-green-100',
        },
        {
          type: 'Sick',
          used: balance.sick.used,
          total: balance.sick.total,
          remaining: balance.sick.remaining,
          icon: Stethoscope,
          color: 'text-red-600',
          bg: 'bg-red-100',
        },
        {
          type: 'Maternity/Paternity',
          used: balance.other.maternity + balance.other.paternity,
          total: 90,
          remaining: 90 - (balance.other.maternity + balance.other.paternity),
          icon: Baby,
          color: 'text-blue-600',
          bg: 'bg-blue-100',
        },
        {
          type: 'Compassionate',
          used: balance.other.compassionate,
          total: 5,
          remaining: 5 - balance.other.compassionate,
          icon: Heart,
          color: 'text-purple-600',
          bg: 'bg-purple-100',
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title={"Leave Management"} description={"Request and track your leave"} />
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetForm}>
                <Plus className="w-4 h-4" />
                Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Request Leave</DialogTitle>
                <DialogDescription>
                  Submit a new leave request for approval
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="leaveType">Leave Type *</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    placeholder="Enter the reason for your leave request"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={actionLoading === 'submit'}>
                  {actionLoading === 'submit' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Leave Balances */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {leaveBalances.map((bal, index) => (
          <motion.div
            key={bal.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${bal.bg}`}>
                    <bal.icon className={`w-6 h-6 ${bal.color}`} />
                  </div>
                  <span className="text-2xl font-bold">{Math.max(0, bal.remaining)}</span>
                </div>
                <p className="text-sm font-medium mb-2">{bal.type}</p>
                <Progress value={bal.total > 0 ? (bal.used / bal.total) * 100 : 0} className="h-2 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {bal.used} used of {bal.total} days
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Leave Requests */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              My Leave Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No leave requests yet</p>
                <p className="text-sm">Click &quot;Request Leave&quot; to submit a new request</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const typeInfo = LEAVE_TYPES.find((t) => t.value === request.type);
                  return (
                    <div
                      key={request.id}
                      className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline">{typeInfo?.label || request.type}</Badge>
                            {getStatusBadge(request.status)}
                          </div>
                          <p className="font-medium">
                            {formatDate(request.startDate)} to {formatDate(request.endDate)} ({request.totalDays} day{request.totalDays > 1 ? 's' : ''})
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">{request.reason}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Applied on {formatDate(request.createdAt)}
                            {request.staffProfile?.manager?.user && (
                              <> &bull; Approver: {request.staffProfile.manager.user.firstName} {request.staffProfile.manager.user.lastName}</>
                            )}
                          </p>
                          {request.status === 'REJECTED' && request.rejectionReason && (
                            <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                              <AlertCircle className="w-4 h-4 inline mr-1" />
                              {request.rejectionReason}
                            </div>
                          )}
                        </div>
                        {(request.status === 'PENDING' || request.status === 'APPROVED') && (
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancel(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              {actionLoading === request.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
