'use client';

import { Suspense, useId, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppShell } from '@/components/prototype/app-shell';
import {
  CompanyAdminLoadingFallback,
  CompanyAdminStateView,
} from '@/components/prototype/company-admin-state';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import {
  type CompanyAdminRoleKey,
  type DemoCompanyMember,
  companyAdminRoleKeys,
  northstarAdminMembership,
  northstarCompany,
  northstarMembers,
  parseCompanyAdminState,
} from '@/lib/demo/company-admin';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';
import { sessionActor } from '@/lib/demo/session';

export default function CompanyAdminMembersPage() {
  return (
    <Suspense fallback={<CompanyAdminLoadingFallback />}>
      <CompanyAdminMembersContent />
    </Suspense>
  );
}

function CompanyAdminMembersContent() {
  const params = useSearchParams();
  const state = parseCompanyAdminState(params.get('state'));
  const membership = northstarAdminMembership();
  const capabilities = membership?.capabilities;
  const notify = usePrototypeFeedback();
  const emailId = useId();
  const roleId = useId();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyAdminRoleKey>('operator');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleMember, setRoleMember] = useState<DemoCompanyMember | null>(null);
  const [previewRole, setPreviewRole] = useState<CompanyAdminRoleKey>('operator');
  const [statusMember, setStatusMember] = useState<DemoCompanyMember | null>(
    null,
  );

  return (
    <AppShell
      view="company-admin"
      capabilities={capabilities}
      workspace={{
        name: northstarCompany.name,
        environment: northstarCompany.environment,
        policyVersion: northstarCompany.policyVersion,
      }}
    >
      <div className="grid gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white shadow-[var(--shadow-sm)]">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.companyAdmin.kicker}
          </p>
          <h1 className="mt-3 text-[2rem] leading-[1.2] font-semibold">
            {messages.companyAdmin.membersTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            {messages.companyAdmin.membersIntro}
          </p>
          <p className="mt-3 text-xs text-white/70">
            {messages.companyAdmin.capabilityHint}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
              render={<Link href="/company/admin" />}
            >
              {messages.companyAdmin.profileTitle}
            </Button>
            <Button
              variant="outline"
              className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
              render={<Link href="/company" />}
            >
              {messages.companyAdmin.backToCompany}
            </Button>
          </div>
        </section>

        {state !== 'ready' ? (
          <CompanyAdminStateView
            state={state}
            retryHref="/company/admin/members"
          />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{messages.companyAdmin.inviteTitle}</CardTitle>
                <CardDescription>{messages.companyAdmin.inviteHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setInviteOpen(true);
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor={emailId}>{messages.companyAdmin.inviteEmail}</Label>
                    <Input
                      id={emailId}
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      className="h-11"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={roleId}>{messages.companyAdmin.inviteRole}</Label>
                    <NativeSelect
                      id={roleId}
                      className="h-11 w-full"
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(event.target.value as CompanyAdminRoleKey)
                      }
                    >
                      {companyAdminRoleKeys.map((role) => (
                        <NativeSelectOption key={role} value={role}>
                          {messages.companyAdmin.roles[role]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="h-11 w-full md:w-auto">
                      {messages.companyAdmin.inviteSubmit}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>{northstarCompany.name}</CardTitle>
                <CardDescription>
                  {interpolate(messages.tenants.roleLine, {
                    role: messages.companyAdmin.roles.tenant_admin,
                    status: messages.companyAdmin.statusValues.active,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{messages.companyAdmin.member}</TableHead>
                      <TableHead>{messages.companyAdmin.role}</TableHead>
                      <TableHead>{messages.companyAdmin.status}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {messages.companyAdmin.capabilities}
                      </TableHead>
                      <TableHead className="text-right">
                        {messages.companyAdmin.updated}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {northstarMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="grid gap-1">
                            <span className="font-medium">{member.displayName}</span>
                            <span className="text-xs text-muted-foreground">
                              {member.email}
                            </span>
                            {member.email === sessionActor.email ? (
                              <span className="text-xs text-muted-foreground">
                                {messages.companyAdmin.selfLabel}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-2">
                            <Badge variant="secondary">
                              {messages.companyAdmin.roles[member.roleKey]}
                            </Badge>
                            {member.status === 'removed' ? null : (
                              <Button
                                variant="ghost"
                                className="h-11 w-fit px-2"
                                onClick={() => {
                                  setPreviewRole(member.roleKey);
                                  setRoleMember(member);
                                }}
                              >
                                {messages.companyAdmin.changeRole}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-2">
                            <Badge variant="outline">
                              {messages.companyAdmin.statusValues[member.status]}
                            </Badge>
                            {member.status === 'active' ? (
                              <Button
                                variant="ghost"
                                className="h-11 w-fit px-2"
                                onClick={() => setStatusMember(member)}
                              >
                                {messages.companyAdmin.suspend}
                              </Button>
                            ) : null}
                            {member.status === 'suspended' ? (
                              <Button
                                variant="ghost"
                                className="h-11 w-fit px-2"
                                onClick={() => setStatusMember(member)}
                              >
                                {messages.companyAdmin.reactivate}
                              </Button>
                            ) : null}
                            {member.invitedAt ? (
                              <span className="text-xs text-muted-foreground">
                                {messages.companyAdmin.invitedAt}:{' '}
                                {formatDateTime(member.invitedAt)}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <ul className="flex max-w-sm flex-wrap gap-1">
                            {member.capabilities.map((capability) => (
                              <li key={capability}>
                                <Badge variant="outline" className="font-normal">
                                  {
                                    messages.companyAdmin.memberCapabilities[
                                      capability
                                    ]
                                  }
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDateTime(member.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <AlertDialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {messages.companyAdmin.inviteConfirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {messages.companyAdmin.inviteConfirmBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.companyAdmin.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                notify(
                  messages.companyAdmin.toastInviteTitle,
                  messages.companyAdmin.toastInviteBody,
                );
                setInviteEmail('');
              }}
            >
              {messages.companyAdmin.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={roleMember !== null}
        onOpenChange={(open) => {
          if (!open) setRoleMember(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {messages.companyAdmin.changeRoleTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {messages.companyAdmin.changeRoleBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="preview-role">{messages.companyAdmin.newRole}</Label>
            <NativeSelect
              id="preview-role"
              className="h-11 w-full"
              value={previewRole}
              onChange={(event) =>
                setPreviewRole(event.target.value as CompanyAdminRoleKey)
              }
            >
              {companyAdminRoleKeys.map((role) => (
                <NativeSelectOption key={role} value={role}>
                  {messages.companyAdmin.roles[role]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.companyAdmin.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                notify(
                  messages.companyAdmin.toastRoleTitle,
                  messages.companyAdmin.toastRoleBody,
                )
              }
            >
              {messages.companyAdmin.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={statusMember !== null}
        onOpenChange={(open) => {
          if (!open) setStatusMember(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusMember?.status === 'suspended'
                ? messages.companyAdmin.reactivateTitle
                : messages.companyAdmin.suspendTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusMember?.status === 'suspended'
                ? messages.companyAdmin.reactivateBody
                : messages.companyAdmin.suspendBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.companyAdmin.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                notify(
                  statusMember?.status === 'suspended'
                    ? messages.companyAdmin.toastReactivateTitle
                    : messages.companyAdmin.toastSuspendTitle,
                  statusMember?.status === 'suspended'
                    ? messages.companyAdmin.toastReactivateBody
                    : messages.companyAdmin.toastSuspendBody,
                )
              }
            >
              {messages.companyAdmin.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
