'use client';

import { useEffect, useState, useCallback } from 'react';
import { usersApi, type UserItem, type UserDetail } from '@/lib/admin-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  KeyRound,
  Eye,
  Shield,
  Mail,
  Smartphone,
  Copy,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

const roleMap: Record<string, { label: string; color: string }> = {
  visitor: { label: '访客', color: 'bg-stone-100 text-stone-600' },
  user: { label: '用户', color: 'bg-sky-100 text-sky-700' },
  admin: { label: '管理员', color: 'bg-amber-100 text-amber-700' },
  super_admin: { label: '超级管理员', color: 'bg-rose-100 text-rose-700' },
};

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'bg-emerald-100 text-emerald-700' },
  banned: { label: '已封禁', color: 'bg-red-100 text-red-700' },
  deleted: { label: '已删除', color: 'bg-stone-100 text-stone-500' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Reset Password Dialog
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdUser, setResetPwdUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Edit Email Dialog
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailUser, setEmailUser] = useState<UserItem | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Edit Nickname Dialog
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nicknameUser, setNicknameUser] = useState<UserItem | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  // Detail Dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Role Change
  const [roleChangeUser, setRoleChangeUser] = useState<UserItem | null>(null);
  const [roleChangeValue, setRoleChangeValue] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.list({
        page,
        page_size: pageSize,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsers(data.list);
      setTotal(data.total);
    } catch {
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const totalPages = Math.ceil(total / pageSize);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await usersApi.updateStatus(id, status);
      toast.success(status === 'banned' ? '已封禁' : '已解封');
      loadUsers();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeUser || !roleChangeValue) return;
    try {
      await usersApi.updateRole(roleChangeUser.id, roleChangeValue);
      toast.success('角色已更新');
      setRoleChangeUser(null);
      loadUsers();
    } catch {
      toast.error('角色更新失败');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdUser || !newPassword.trim()) {
      toast.error('请输入新密码');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('密码至少6位');
      return;
    }
    setResetting(true);
    try {
      await usersApi.resetPassword(resetPwdUser.id, newPassword);
      toast.success('密码已重置');
      setResetPwdOpen(false);
      setResetPwdUser(null);
      setNewPassword('');
    } catch {
      toast.error('重置密码失败');
    } finally {
      setResetting(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!emailUser) return;
    if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
      toast.error('邮箱格式不正确');
      return;
    }
    setSavingEmail(true);
    try {
      await usersApi.updateEmail(emailUser.id, editEmail);
      toast.success('邮箱已更新');
      setEmailOpen(false);
      setEmailUser(null);
      setEditEmail('');
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新邮箱失败';
      toast.error(msg);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const data = await usersApi.getDetail(id);
      setDetailUser(data);
    } catch {
      toast.error('获取用户详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制到剪贴板');
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openRoleChange = (user: UserItem) => {
    setRoleChangeUser(user);
    setRoleChangeValue(user.role);
  };

  const openEmailEdit = (user: UserItem) => {
    setEmailUser(user);
    setEditEmail(user.email || '');
    setEmailOpen(true);
  };

  const openNicknameEdit = (user: UserItem) => {
    setNicknameUser(user);
    setEditNickname(user.nickname || '');
    setNicknameOpen(true);
  };

  const handleUpdateNickname = async () => {
    if (!nicknameUser) return;
    if (editNickname && editNickname.trim().length === 0) {
      toast.error('昵称不能为空白');
      return;
    }
    if (editNickname && editNickname.length > 50) {
      toast.error('昵称长度不能超过50个字符');
      return;
    }
    setSavingNickname(true);
    try {
      await usersApi.updateNickname(nicknameUser.id, editNickname.trim());
      toast.success('昵称已更新');
      setNicknameOpen(false);
      setNicknameUser(null);
      setEditNickname('');
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新昵称失败';
      toast.error(msg);
    } finally {
      setSavingNickname(false);
    }
  };

  const openResetPwd = (user: UserItem) => {
    setResetPwdUser(user);
    setNewPassword('');
    setResetPwdOpen(true);
  };

  // 截断显示openid
  const truncateId = (id: string | null | undefined, len = 10) => {
    if (!id) return '-';
    if (id.length <= len * 2) return id;
    return `${id.slice(0, len)}...${id.slice(-len)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">用户管理</h1>
        <p className="text-sm text-stone-500">管理系统用户，支持微信小程序登录用户</p>
      </div>

      {/* Filters */}
      <Card className="border-stone-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                placeholder="搜索昵称、邮箱、微信OpenID..."
                className="pl-9 border-stone-200"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] border-stone-200">
                <SelectValue placeholder="角色筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="visitor">访客</SelectItem>
                <SelectItem value="user">用户</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="super_admin">超级管理员</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] border-stone-200">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">正常</SelectItem>
                <SelectItem value="banned">已封禁</SelectItem>
                <SelectItem value="deleted">已删除</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-stone-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">暂无用户数据</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">头像</TableHead>
                    <TableHead>昵称</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>微信OpenID</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatarUrl || undefined} alt={user.nickname || ''} />
                          <AvatarFallback className="bg-stone-100 text-stone-600 text-xs">
                            {(user.nickname || user.email || '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium text-stone-800 max-w-[100px] truncate">
                        {user.nickname || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-stone-500 max-w-[160px] truncate">
                        {user.email || '-'}
                      </TableCell>
                      <TableCell>
                        {user.openid ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs font-mono text-emerald-600 border-emerald-200 bg-emerald-50">
                              <Smartphone className="h-3 w-3 mr-1" />
                              {truncateId(user.openid, 6)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => copyToClipboard(user.openid!)}
                              title="复制完整OpenID"
                            >
                              <Copy className="h-3 w-3 text-stone-400" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-300">未绑定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${roleMap[user.role]?.color || 'bg-stone-100'}`}>
                          {roleMap[user.role]?.label || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${statusMap[user.status]?.color || 'bg-stone-100'}`}>
                          {statusMap[user.status]?.label || user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-stone-400 whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleViewDetail(user.id)}
                            title="查看详情"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openNicknameEdit(user)}
                            title="修改昵称"
                          >
                            <Pencil className="h-4 w-4 text-violet-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEmailEdit(user)}
                            title="修改邮箱"
                          >
                            <Mail className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openRoleChange(user)}
                            title="修改角色"
                          >
                            <Shield className="h-4 w-4 text-amber-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openResetPwd(user)}
                            title="重置密码"
                          >
                            <KeyRound className="h-4 w-4 text-sky-500" />
                          </Button>
                          {user.status === 'active' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => handleStatusUpdate(user.id, 'banned')}
                              title="封禁"
                            >
                              <span className="text-xs font-medium">禁</span>
                            </Button>
                          ) : user.status === 'banned' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-500"
                              onClick={() => handleStatusUpdate(user.id, 'active')}
                              title="解封"
                            >
                              <span className="text-xs font-medium">启</span>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-stone-500">
            共 {total} 条，第 {page}/{totalPages} 页
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="border-stone-200"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="border-stone-200"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Nickname Dialog */}
      <Dialog open={nicknameOpen} onOpenChange={(open) => { if (!open) setNicknameOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改昵称</DialogTitle>
            <DialogDescription className="sr-only">修改用户昵称</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-stone-500">用户</Label>
              <p className="text-sm font-medium text-stone-700 mt-1">
                {nicknameUser?.email || nicknameUser?.id || '-'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>新昵称</Label>
              <Input
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="输入新昵称（留空则清除昵称）"
                className="border-stone-200"
                maxLength={50}
              />
              <p className="text-xs text-stone-400">留空可清除该用户的昵称，昵称最多50个字符</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNicknameOpen(false)} className="border-stone-200">
              取消
            </Button>
            <Button onClick={handleUpdateNickname} disabled={savingNickname} className="bg-violet-600 hover:bg-violet-700">
              {savingNickname && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存昵称
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={(open) => { if (!open) setEmailOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改邮箱</DialogTitle>
            <DialogDescription className="sr-only">修改用户邮箱地址</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-stone-500">用户</Label>
              <p className="text-sm font-medium text-stone-700 mt-1">
                {emailUser?.nickname || emailUser?.email || '-'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>新邮箱</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="输入新邮箱地址（留空则清除邮箱）"
                className="border-stone-200"
              />
              <p className="text-xs text-stone-400">留空可清除该用户的邮箱绑定</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} className="border-stone-200">
              取消
            </Button>
            <Button onClick={handleUpdateEmail} disabled={savingEmail} className="bg-blue-600 hover:bg-blue-700">
              {savingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存邮箱
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwdOpen} onOpenChange={(open) => { if (!open) setResetPwdOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription className="sr-only">重置用户登录密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-stone-500">用户</Label>
              <p className="text-sm font-medium text-stone-700 mt-1">
                {resetPwdUser?.nickname || resetPwdUser?.email || '-'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新密码（至少6位）"
                className="border-stone-200"
              />
              <p className="text-xs text-stone-400">密码重置后，该用户需要使用新密码登录</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwdOpen(false)} className="border-stone-200">
              取消
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting} className="bg-amber-600 hover:bg-amber-700">
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={!!roleChangeUser} onOpenChange={() => setRoleChangeUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改角色</DialogTitle>
            <DialogDescription className="sr-only">修改用户角色权限</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-stone-500">用户</Label>
              <p className="text-sm font-medium text-stone-700 mt-1">
                {roleChangeUser?.nickname || roleChangeUser?.email || '-'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={roleChangeValue} onValueChange={setRoleChangeValue}>
                <SelectTrigger className="border-stone-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visitor">访客</SelectItem>
                  <SelectItem value="user">用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="super_admin">超级管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleChangeUser(null)} className="border-stone-200">
              取消
            </Button>
            <Button onClick={handleRoleChange} className="bg-amber-600 hover:bg-amber-700">
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>用户详情</DialogTitle>
            <DialogDescription className="sr-only">查看用户详细信息</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : detailUser ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={detailUser.avatarUrl || undefined} alt={detailUser.nickname || ''} />
                  <AvatarFallback className="bg-stone-100 text-stone-600 text-lg">
                    {(detailUser.nickname || detailUser.email || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold text-stone-800">{detailUser.nickname || '未设置昵称'}</p>
                  <p className="text-sm text-stone-500">{detailUser.email || '-'}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-stone-400">角色：</span>
                  <Badge className={`text-xs ${roleMap[detailUser.role]?.color || 'bg-stone-100'}`}>
                    {roleMap[detailUser.role]?.label || detailUser.role}
                  </Badge>
                </div>
                <div>
                  <span className="text-stone-400">状态：</span>
                  <Badge className={`text-xs ${statusMap[detailUser.status]?.color || 'bg-stone-100'}`}>
                    {statusMap[detailUser.status]?.label || detailUser.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-stone-400">手机：</span>
                  <span className="text-stone-700">{detailUser.phone || '-'}</span>
                </div>
                <div>
                  <span className="text-stone-400">注册时间：</span>
                  <span className="text-stone-700">{formatDate(detailUser.createdAt)}</span>
                </div>
              </div>

              {/* 微信小程序信息 */}
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <Smartphone className="h-4 w-4 text-emerald-500" />
                  微信小程序信息
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">OpenID：</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-white border border-stone-200 rounded px-2 py-0.5 max-w-[200px] truncate block">
                        {detailUser.openid || '未绑定'}
                      </code>
                      {detailUser.openid && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => copyToClipboard(detailUser.openid!)}
                        >
                          <Copy className="h-3 w-3 text-stone-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">UnionID：</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-white border border-stone-200 rounded px-2 py-0.5 max-w-[200px] truncate block">
                        {detailUser.unionid || '未绑定'}
                      </code>
                      {detailUser.unionid && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => copyToClipboard(detailUser.unionid!)}
                        >
                          <Copy className="h-3 w-3 text-stone-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 账号操作 */}
              <div className="rounded-lg border border-stone-200 p-3 space-y-2">
                <div className="text-sm font-medium text-stone-700">账号操作</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-violet-200 text-violet-600 hover:bg-violet-50"
                    onClick={() => {
                      setDetailOpen(false);
                      setTimeout(() => openNicknameEdit(detailUser), 200);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    修改昵称
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={() => {
                      setDetailOpen(false);
                      setTimeout(() => openEmailEdit(detailUser), 200);
                    }}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    修改邮箱
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-sky-200 text-sky-600 hover:bg-sky-50"
                    onClick={() => {
                      setDetailOpen(false);
                      setTimeout(() => openResetPwd(detailUser), 200);
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5 mr-1" />
                    重置密码
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-200 text-amber-600 hover:bg-amber-50"
                    onClick={() => {
                      setDetailOpen(false);
                      setTimeout(() => openRoleChange(detailUser), 200);
                    }}
                  >
                    <Shield className="h-3.5 w-3.5 mr-1" />
                    修改角色
                  </Button>
                </div>
              </div>

              {detailUser.bio && (
                <div>
                  <span className="text-stone-400 text-sm">个人简介：</span>
                  <p className="text-sm text-stone-700 mt-1">{detailUser.bio}</p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
