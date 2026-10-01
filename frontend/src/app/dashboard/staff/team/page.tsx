'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  Mail,
  Phone,
  Building,
  Loader2,
  RefreshCw,
  Crown,
  UserCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';

interface TeamMember {
  id: string;
  employeeId: string;
  position: string;
  title: string;
  isActive: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatar: string | null;
  };
  department?: { id: string; name: string } | null;
  managerId?: string | null;
}

interface StaffProfile {
  id: string;
  department?: { id: string; name: string } | null;
  manager?: {
    id: string;
    user: { firstName: string; lastName: string };
  } | null;
  user: {
    firstName: string;
    lastName: string;
  };
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [departmentHead, setDepartmentHead] = useState<TeamMember | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // First get my dashboard to get my staff profile and department
      const dashboardRes: any = await api.get('/staff/dashboard');
      const dashboardData = dashboardRes?.data || dashboardRes;
      const myProfile = dashboardData?.profile;
      setProfile(myProfile);

      if (!myProfile) {
        toast.error('Could not find your staff profile');
        setLoading(false);
        return;
      }

      // Then get my team hierarchy
      const teamRes: any = await api.get(`/staff/${myProfile.id}/team`);
      const teamData = teamRes?.data || teamRes;

      // The team endpoint returns a hierarchy structure
      // Let's also get direct reports if we're a manager
      let allTeamMembers: TeamMember[] = [];

      if (Array.isArray(teamData)) {
        allTeamMembers = teamData;
      } else if (teamData?.directReports) {
        allTeamMembers = teamData.directReports;
      }

      // Try to get all staff in the same department if available
      // If not manager, we might get empty array, so try getting department members
      if (myProfile.department?.id) {
        try {
          // Try fetching department members - this may fail if not admin
          const deptRes: any = await api.get(`/departments/${myProfile.department.id}`);
          const deptData = deptRes?.data || deptRes;
          if (deptData?.head) {
            setDepartmentHead(deptData.head);
          }
        } catch {
          // Not allowed to fetch department details
        }
      }

      // If we have a manager, add them to the list
      if (myProfile.manager) {
        const managerExists = allTeamMembers.some(m => m.id === myProfile.manager?.id);
        if (!managerExists && myProfile.manager.id) {
          // Manager will be shown separately
        }
      }

      setTeamMembers(allTeamMembers);
    } catch (err: any) {
      console.error('Failed to fetch team:', err);
      toast.error(err.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMembers = teamMembers.filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = `${member.user.firstName} ${member.user.lastName}`.toLowerCase();
    return (
      name.includes(query) ||
      member.title?.toLowerCase().includes(query) ||
      member.user.email?.toLowerCase().includes(query)
    );
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader title={"My Team"} description={"View and connect with your team members"} />
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              className="pl-9 w-full sm:w-[250px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Department Info */}
      {profile?.department && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{profile.department.name}</h2>
                  <p className="text-muted-foreground">
                    {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}
                    {profile.manager && (
                      <> &bull; Manager: {profile.manager.user.firstName} {profile.manager.user.lastName}</>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Manager Card */}
      {profile?.manager && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Your Manager</span>
              </div>
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  <AvatarFallback className="bg-yellow-600 text-white text-lg">
                    {getInitials(profile.manager.user.firstName, profile.manager.user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">
                    {profile.manager.user.firstName} {profile.manager.user.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">Team Manager</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Team Grid */}
      {filteredMembers.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">
              {teamMembers.length === 0 ? 'No team members found' : 'No matches found'}
            </p>
            <p className="text-sm">
              {teamMembers.length === 0
                ? 'Team members in your department or direct reports will appear here'
                : 'Try adjusting your search query'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member, index) => {
            const isCurrentUser = member.id === profile?.id;
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Card className={`hover:shadow-lg transition-shadow ${isCurrentUser ? 'border-primary/30 bg-primary/5' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <Avatar className="w-14 h-14">
                          {member.user.avatar && (
                            <AvatarImage src={getImageUrl(member.user.avatar)} alt={member.user.firstName} />
                          )}
                          <AvatarFallback className="bg-primary text-white text-lg">
                            {getInitials(member.user.firstName, member.user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        {member.isActive && (
                          <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white bg-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">
                            {member.user.firstName} {member.user.lastName}
                          </h3>
                          {isCurrentUser && (
                            <Badge className="bg-primary/10 text-primary">You</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.title || member.position}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {member.department?.name || 'No Department'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="truncate">{member.user.email}</span>
                      </div>
                      {member.user.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4 shrink-0" />
                          <span>{member.user.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserCircle className="w-4 h-4 shrink-0" />
                        <span>ID: {member.employeeId}</span>
                      </div>
                    </div>

                    {!isCurrentUser && (
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => window.location.href = `mailto:${member.user.email}`}
                        >
                          <Mail className="w-4 h-4" />
                          Email
                        </Button>
                        {member.user.phone && (
                          <Button
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() => window.location.href = `tel:${member.user.phone}`}
                          >
                            <Phone className="w-4 h-4" />
                            Call
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
