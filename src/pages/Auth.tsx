import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dumbbell, Users } from "lucide-react";
import { mapSupabaseError } from "@/lib/errorMapping";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { MetaHead } from "@/components/MetaHead";
import { Footer } from "@/components/layout/Footer";

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupRole, setSignupRole] = useState<"coach" | "athlete">("athlete");

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        // Forza la scelta dell'account anche se l'utente è già loggato in Google
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        toast.error(mapSupabaseError(result.error));
        setLoading(false);
        return;
      }
      if (result.redirected) return; // Browser is redirecting to Google
      window.location.href = "/";
    } catch (error: unknown) {
      toast.error(mapSupabaseError(error));
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      toast.error("Inserisci la tua email prima di procedere");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("forgot-password", {
        body: { email: loginEmail, redirectTo: `${window.location.origin}/reset-password` },
      });
      if (error) throw error;
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }
      toast.success("Email di recupero inviata! Controlla la tua casella di posta.");
    } catch (error: unknown) {
      toast.error(mapSupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      toast.success("Login effettuato!");
      navigate("/");
    } catch (error: unknown) {
      toast.error(mapSupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(signupEmail, signupPassword, signupName, signupRole);
      toast.success("Account creato! Benvenuto!");
      navigate(signupRole === "coach" ? "/coach" : "/onboarding");
    } catch (error: unknown) {
      toast.error(mapSupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MetaHead title="Accedi" description="Accedi o registrati alla piattaforma CoachHub." />
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Dumbbell className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">CoachHub</CardTitle>
            <CardDescription>Piattaforma per coaching ibrido</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Accedi</TabsTrigger>
                <TabsTrigger value="signup">Registrati</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 mb-4"
                  onClick={handleGoogle}
                  disabled={loading}
                >
                  <GoogleIcon />
                  Continua con Google
                </Button>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">oppure</span>
                  </div>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="coach@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full gradient-primary" disabled={loading}>
                    {loading ? "Accesso in corso..." : "Accedi"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                    onClick={handleForgotPassword}
                    disabled={loading}
                  >
                    Password dimenticata?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 mb-4"
                  onClick={handleGoogle}
                  disabled={loading}
                >
                  <GoogleIcon />
                  Registrati con Google
                </Button>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">oppure</span>
                  </div>
                </div>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Mario Rossi"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="mario@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Sono un...</Label>
                    <RadioGroup
                      value={signupRole}
                      onValueChange={(v) => setSignupRole(v as "coach" | "athlete")}
                      className="grid grid-cols-2 gap-4"
                    >
                      <Label
                        htmlFor="role-coach"
                        className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                          signupRole === "coach" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <RadioGroupItem value="coach" id="role-coach" className="sr-only" />
                        <Users className="h-6 w-6 mb-2 text-primary" />
                        <span className="text-sm font-medium">Coach</span>
                      </Label>
                      <Label
                        htmlFor="role-athlete"
                        className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                          signupRole === "athlete" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <RadioGroupItem value="athlete" id="role-athlete" className="sr-only" />
                        <Dumbbell className="h-6 w-6 mb-2 text-primary" />
                        <span className="text-sm font-medium">Atleta</span>
                      </Label>
                    </RadioGroup>
                  </div>

                  <Button type="submit" className="w-full gradient-primary" disabled={loading}>
                    {loading ? "Creazione account..." : "Crea account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <div className="mt-auto w-full">
          <Footer />
        </div>
      </div>
    </>
  );
}
