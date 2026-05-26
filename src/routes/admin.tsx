import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Activity, FileText, BarChart3, Trash2, UserPlus, ArrowRight, LogOut } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  getAdminStats, listUsers, createUserWithRole, updateUserRole, deleteUser, listAuditLog,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (!role || role.role !== "admin") throw redirect({ to: "/" });
  },
  component: AdminPage,
  head: () => ({ meta: [{ title: "الإدارة — جميل ماب" }] }),
});

function AdminPage() {
  const logout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <h1 className="text-lg font-bold">لوحة الإدارة</h1>
              <p className="text-xs text-muted-foreground">جميل ماب</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/"><Button variant="outline" size="sm"><ArrowRight className="ml-1 h-4 w-4" /> الرئيسية</Button></Link>
            <Button variant="outline" size="sm" onClick={logout}><LogOut className="ml-1 h-4 w-4" /> خروج</Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="stats"><BarChart3 className="ml-1 h-4 w-4" /> الإحصائيات</TabsTrigger>
            <TabsTrigger value="users"><Users className="ml-1 h-4 w-4" /> المستخدمون</TabsTrigger>
            <TabsTrigger value="create"><UserPlus className="ml-1 h-4 w-4" /> إنشاء</TabsTrigger>
            <TabsTrigger value="audit"><FileText className="ml-1 h-4 w-4" /> السجلات</TabsTrigger>
          </TabsList>
          <TabsContent value="stats"><StatsTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="create"><CreateUserTab /></TabsContent>
          <TabsContent value="audit"><AuditTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatsTab() {
  const fn = useServerFn(getAdminStats);
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn() });
  if (isLoading) return <Loader />;
  if (!data) return null;
  const cards = [
    { label: "المستخدمون", v: data.totals.users, icon: Users },
    { label: "الوظائف", v: data.totals.jobs, icon: Activity },
    { label: "النتائج", v: data.totals.results, icon: BarChart3 },
    { label: "قيد التشغيل", v: data.totals.running, icon: Loader2 },
    { label: "مكتملة", v: data.totals.completed, icon: BarChart3 },
    { label: "فاشلة", v: data.totals.failed, icon: BarChart3 },
  ];
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center justify-between">
              <c.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{c.v.toLocaleString("ar")}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">آخر 14 يوم — الوظائف والنتائج</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="jobs" stroke="hsl(var(--primary))" name="وظائف" />
              <Line type="monotone" dataKey="results" stroke="hsl(var(--accent))" name="نتائج" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function UsersTab() {
  const fn = useServerFn(listUsers);
  const updateFn = useServerFn(updateUserRole);
  const deleteFn = useServerFn(deleteUser);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => fn() });
  const upd = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "manager" | "viewer" }) => updateFn({ data: v }),
    onSuccess: () => { toast.success("تم تحديث الدور"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isLoading) return <Loader />;
  return (
    <div className="mt-6 space-y-3">
      {data?.users.map((u) => (
        <Card key={u.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{u.email}</p>
              <p className="text-xs text-muted-foreground">آخر دخول: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("ar") : "—"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={u.role} onValueChange={(v) => upd.mutate({ userId: u.id, role: v as "admin" | "manager" | "viewer" })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="manager">manager</SelectItem>
                  <SelectItem value="viewer">viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm(`حذف ${u.email}?`)) del.mutate(u.id); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CreateUserTab() {
  const fn = useServerFn(createUserWithRole);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "viewer">("viewer");
  const m = useMutation({
    mutationFn: () => fn({ data: { email, password, role } }),
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم");
      setEmail(""); setPassword(""); setRole("viewer");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="mt-6 max-w-md p-6">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
        <div className="space-y-2">
          <Label>البريد الإلكتروني</Label>
          <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>كلمة المرور</Label>
          <Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </div>
        <div className="space-y-2">
          <Label>الدور</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "admin" | "manager" | "viewer")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin — صلاحيات كاملة</SelectItem>
              <SelectItem value="manager">manager — تشغيل وتحميل</SelectItem>
              <SelectItem value="viewer">viewer — قراءة فقط</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={m.isPending} className="w-full">
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء المستخدم"}
        </Button>
      </form>
    </Card>
  );
}

function AuditTab() {
  const fn = useServerFn(listAuditLog);
  const { data, isLoading } = useQuery({ queryKey: ["admin-audit"], queryFn: () => fn() });
  if (isLoading) return <Loader />;
  return (
    <div className="mt-6 space-y-2">
      {data?.entries.length === 0 && <p className="text-center text-sm text-muted-foreground">لا توجد سجلات بعد.</p>}
      {data?.entries.map((e) => (
        <Card key={e.id} className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{e.action}</Badge>
              <span className="text-sm">{e.user_email || "—"}</span>
            </div>
            <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("ar")}</span>
          </div>
          {e.details && Object.keys(e.details as Record<string, unknown>).length > 0 && (
            <pre className="mt-2 overflow-x-auto rounded bg-muted/30 p-2 text-xs">{JSON.stringify(e.details, null, 2)}</pre>
          )}
        </Card>
      ))}
    </div>
  );
}

function Loader() {
  return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}
