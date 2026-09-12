'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { InfoIcon, KeyRoundIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { demoNotice } from '@/lib/demo/data';
import { MitigaMark } from '@/components/prototype/mitiga-mark';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';

export default function LoginPage() {
  const router = useRouter();
  const notify = usePrototypeFeedback();
  const [email, setEmail] = useState('helena.duarte@demo.mitiga.local');
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[image:var(--gradient-canvas)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[42%] bg-[image:var(--gradient-shell)] lg:block"
      />
      <div className="relative mx-auto grid min-h-screen max-w-[90rem] lg:grid-cols-[minmax(18rem,2fr)_minmax(22rem,3fr)]">
        <section className="hidden flex-col justify-between px-10 py-12 text-white lg:flex">
          <MitigaMark className="text-white" />
          <div className="max-w-md space-y-4">
            <p className="text-[0.7rem] tracking-[0.14em] uppercase text-white/70">
              Campo de risco
            </p>
            <h1 className="text-[2rem] leading-[1.2] font-semibold">
              Confiança silenciosa para decisões auditáveis.
            </h1>
            <p className="text-sm leading-6 text-white/80">
              Este login não autentica ninguém. Ele apenas abre o protótipo das
              visões Empresa, Super admin e Operador, com dados fictícios.
            </p>
          </div>
          <p className="text-xs text-white/55">MITIGA · demonstração frontend</p>
        </section>

        <section className="flex items-center px-4 py-10 sm:px-8">
          <Card className="mx-auto w-full max-w-md shadow-[var(--shadow-sm)] ring-border">
            <CardHeader className="space-y-3">
              <div className="lg:hidden">
                <MitigaMark />
              </div>
              <CardTitle className="text-[1.375rem] leading-[1.3]">
                Entrar no protótipo
              </CardTitle>
              <CardDescription>
                Use qualquer valor. Nenhuma credencial é validada ou enviada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert className="border-[#c5d4dc] bg-[#e4edf2]">
                <InfoIcon />
                <AlertTitle>Ambiente de protótipo</AlertTitle>
                <AlertDescription>{demoNotice}</AlertDescription>
              </Alert>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubmitted(true);
                  notify(
                    'Sessão de demonstração iniciada',
                    'Nenhuma autenticação real foi executada.',
                  );
                  router.push('/empresa');
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail de demonstração</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha (não verificada)</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    defaultValue="nao-e-uma-senha-real"
                    className="h-11"
                  />
                </div>
                {submitted ? (
                  <output className="block text-sm text-muted-foreground">
                    Abrindo a visão empresa…
                  </output>
                ) : null}
                <Button type="submit" className="h-11 w-full">
                  Continuar no protótipo
                </Button>
              </form>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() =>
                    notify(
                      'SSO indisponível',
                      'O acesso federado não faz parte deste protótipo.',
                    )
                  }
                >
                  <KeyRoundIcon />
                  Entrar com SSO
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11"
                  onClick={() =>
                    notify(
                      'Recuperação indisponível',
                      'Não há envio de e-mail nem fluxo de 2FA neste protótipo.',
                    )
                  }
                >
                  Recuperar senha
                </Button>
              </div>

              <nav aria-label="Atalhos do protótipo" className="flex flex-wrap gap-3 text-sm">
                <Link className="underline-offset-4 hover:underline" href="/empresa">
                  Empresa
                </Link>
                <Link className="underline-offset-4 hover:underline" href="/super-admin">
                  Super admin
                </Link>
                <Link className="underline-offset-4 hover:underline" href="/operador">
                  Operador
                </Link>
              </nav>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
