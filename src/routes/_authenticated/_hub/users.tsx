import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser, listUsers, setUserActive, updateUser, deleteUser } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, UserPlus, ShieldCheck, Pencil, Trash2, Phone, ExternalLink, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarSrc } from "@/components/avatar-image";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { userCreateSchema, userUpdateSchema, APP_ROLES, type UserCreateInput, type UserUpdateInput } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/_hub/users")({
  component: UsersPage,
});

const ROLE_LABELS: Record<string, string> = {
  super_admin: "مدير عام",
  admin: "مسؤول",
  dept_manager: "مدير قسم",
  dept_assistant: "مساعد قسم",
  reception: "استقبال",
  editor: "مونتاج",
  designer: "ديزاين",
  photographer: "تصوير",
  staff: "موظف",
  viewer: "اطلاع فقط",
};

function UsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const toggle = useServerFn(setUserActive);
  const update = useServerFn(updateUser);
  const remove = useServerFn(deleteUser);

  const { data: users = [], isLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ["users"], queryFn: () => list(),
  });

  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<null | {
    id: string; display_name: string; name_ar: string; phone: string; role: string; password: string;
  }>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const createForm = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { username: "", password: "", display_name: "", name_ar: "", phone: "", role: "staff" },
  });

  const editForm = useForm<UserUpdateInput>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: { user_id: "", display_name: "", name_ar: "", phone: "", role: "staff", password: "" },
  });

  useEffect(() => {
    if (editUser) {
      editForm.reset({
        user_id: editUser.id,
        display_name: editUser.display_name,
        name_ar: editUser.name_ar,
        phone: editUser.phone,
        role: editUser.role as UserUpdateInput["role"],
        password: "",
      });
    }
  }, [editUser, editForm]);

  const createMutation = useMutation({
    mutationFn: (values: UserCreateInput) =>
      create({
        data: {
          username: values.username,
          password: values.password,
          display_name: values.display_name,
          name_ar: values.name_ar || undefined,
          phone: values.phone || undefined,
          roles: [values.role],
        },
      }),
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم");
      setOpen(false);
      createForm.reset({ username: "", password: "", display_name: "", name_ar: "", phone: "", role: "staff" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "فشل الإنشاء"),
  });

  const toggleMutation = useMutation({
    mutationFn: (p: { user_id: string; is_active: boolean }) => toggle({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const updateMutation = useMutation({
    mutationFn: (values: UserUpdateInput) =>
      update({
        data: {
          user_id: values.user_id,
          display_name: values.display_name,
          name_ar: values.name_ar || undefined,
          phone: values.phone || null,
          roles: [values.role],
          password: values.password || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      setEditUser(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "فشل التعديل"),
  });

  const deleteMutation = useMutation({
    mutationFn: (user_id: string) => remove({ data: { user_id } }),
    onSuccess: () => {
      toast.success("تم حذف المستخدم");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "فشل الحذف"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة المستخدمين</h1>
          <p className="text-sm text-muted-foreground mt-1">إضافة وإدارة الأدمنز والموظفين</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> مستخدم جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة مستخدم جديد</DialogTitle></DialogHeader>
            <Form {...createForm}>
              <form id="create-user-form" onSubmit={createForm.handleSubmit((v) => createMutation.mutate(v))} className="grid gap-4">
                <FormField
                  control={createForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>اسم المستخدم</FormLabel>
                      <FormControl>
                        <Input dir="ltr" placeholder="example: ahmed_m" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>كلمة المرور</FormLabel>
                      <FormControl>
                        <Input type="password" dir="ltr" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>الاسم الكامل</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="name_ar"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>الاسم بالعربي</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>رقم الهاتف (اختياري)</FormLabel>
                      <FormControl>
                        <Input dir="ltr" placeholder="01xxxxxxxxx" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>الصلاحية</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {APP_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            <DialogFooter>
              <Button type="submit" form="create-user-form" disabled={createMutation.isPending || createForm.formState.isSubmitting}>
                <Plus className="h-4 w-4 ml-1" />
                {createMutation.isPending ? "جاري الحفظ..." : "إنشاء"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم، اسم المستخدم، أو الهاتف..."
            className="pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="كل الصلاحيات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الصلاحيات</SelectItem>
            {APP_ROLES.map((r) => (<SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {usersError ? (
        <Card className="p-12 text-center text-sm text-destructive">
          <div className="font-medium">تعذّر تحميل المستخدمين</div>
          <div className="mt-2 text-xs text-muted-foreground" dir="ltr">
            {usersError instanceof Error ? usersError.message : "Unknown error"}
          </div>
          <Button variant="outline" className="mt-4" onClick={() => void refetchUsers()}>
            إعادة المحاولة
          </Button>
        </Card>
      ) : isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">جاري التحميل...</div>
      ) : (() => {
        const q = search.trim().toLowerCase();
        const filtered = users.filter((u) => {
          if (roleFilter !== "all" && !u.roles.includes(roleFilter)) return false;
          if (!q) return true;
          return (
            (u.display_name ?? "").toLowerCase().includes(q) ||
            (u.name_ar ?? "").toLowerCase().includes(q) ||
            (u.username ?? "").toLowerCase().includes(q) ||
            (u.phone ?? "").toLowerCase().includes(q)
          );
        });
        if (filtered.length === 0) {
          return <Card className="p-12 text-center text-sm text-muted-foreground">لا يوجد نتائج</Card>;
        }
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((u) => (
              <ProfileCard
                key={u.id}
                user={u}
                onEdit={() => setEditUser({
                  id: u.id,
                  display_name: u.display_name ?? "",
                  name_ar: u.name_ar ?? "",
                  phone: u.phone ?? "",
                  role: u.roles[0] ?? "staff",
                  password: "",
                })}
                onToggle={(v) => toggleMutation.mutate({ user_id: u.id, is_active: v })}
                onDelete={() => setDeleteId(u.id)}
              />
            ))}
          </div>
        );
      })()}

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل المستخدم</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form id="edit-user-form" onSubmit={editForm.handleSubmit((v) => updateMutation.mutate(v))} className="grid gap-4">
              <FormField
                control={editForm.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>الاسم الكامل</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="name_ar"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>الاسم بالعربي</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>رقم الهاتف</FormLabel>
                    <FormControl>
                      <Input dir="ltr" placeholder="01xxxxxxxxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>الصلاحية</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {APP_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>كلمة مرور جديدة (اختياري)</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        dir="ltr"
                        placeholder="اترك فارغًا للإبقاء على كلمة المرور الحالية"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter>
            <Button type="submit" form="edit-user-form" disabled={updateMutation.isPending || editForm.formState.isSubmitting}>
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المستخدم نهائيًا ولا يمكن التراجع. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type UserRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  name_ar: string | null;
  phone: string | null;
  is_active: boolean;
  avatar_url: string | null;
  job_title: string | null;
  bio: string | null;
  roles: string[];
};

function ProfileCard({
  user, onEdit, onToggle, onDelete,
}: {
  user: UserRow;
  onEdit: () => void;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const avatar = useAvatarSrc(user.avatar_url);
  const name = user.display_name || user.name_ar || user.username || "—";
  const initials = name.trim().slice(0, 2).toUpperCase();
  const isSuper = user.roles.includes("super_admin");
  return (
    <Card className="overflow-hidden group relative flex flex-col hover:shadow-lg transition-shadow">
      <Link
        to="/profile/$userId"
        params={{ userId: user.id }}
        className="absolute inset-0 z-0"
        aria-label={`فتح بروفايل ${name}`}
      />
      <div className="h-20 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent pointer-events-none" />
      <div className="px-5 pb-5 -mt-10 flex flex-col items-center text-center">
        <Avatar className="h-20 w-20 ring-4 ring-card shadow-md">
            {avatar && <AvatarImage src={avatar} alt={name} />}
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        <div className="mt-3 font-semibold text-base line-clamp-1 group-hover:underline">
          {name}
        </div>
        <div className="text-xs text-muted-foreground line-clamp-1" dir="ltr">
          @{user.username || "—"}
        </div>
        {user.job_title && (
          <div className="text-xs text-foreground/70 mt-1 line-clamp-1">{user.job_title}</div>
        )}
        <div className="flex flex-wrap gap-1 justify-center mt-3">
          {user.roles.map((r) => (
            <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"} className="text-[10px]">
              {r === "super_admin" && <ShieldCheck className="h-3 w-3 ml-1" />}
              {ROLE_LABELS[r] ?? r}
            </Badge>
          ))}
        </div>
        {user.phone && (
          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1" dir="ltr">
            <Phone className="h-3 w-3" /> {user.phone}
          </div>
        )}
        <div className="w-full border-t mt-4 pt-3 flex items-center justify-between relative z-10">
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch checked={user.is_active} onCheckedChange={onToggle} />
            <span className="text-xs text-muted-foreground">{user.is_active ? "نشط" : "موقوف"}</span>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button asChild variant="ghost" size="icon" title="عرض البروفايل">
              <Link to="/profile/$userId" params={{ userId: user.id }}>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 ml-2" /> تعديل البيانات
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={isSuper}
                  onClick={onDelete}>
                  <Trash2 className="h-4 w-4 ml-2" /> حذف المستخدم
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </Card>
  );
}
