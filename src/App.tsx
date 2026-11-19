import { lazy, Suspense, useEffect } from "react";
import { AppProvider, useApp } from "./store";
import { Toaster } from "./shell";
import { resolveRoute } from "./lib/routing";

const SCREENS = {
  Landing: lazy(() => import("./screens/Landing").then(module => ({ default: module.Landing }))),
  Dashboard: lazy(() => import("./screens/Dashboard").then(module => ({ default: module.Dashboard }))),
  Wizard: lazy(() => import("./screens/Wizard").then(module => ({ default: module.Wizard }))),
  Hub: lazy(() => import("./screens/Hub").then(module => ({ default: module.Hub }))),
  Editor: lazy(() => import("./screens/Editor").then(module => ({ default: module.Editor }))),
  Reader: lazy(() => import("./screens/Reader").then(module => ({ default: module.Reader }))),
  Profile: lazy(() => import("./screens/account/Profile").then(module => ({ default: module.Profile }))),
  Legal: lazy(() => import("./screens/Legal").then(module => ({ default: module.Legal }))),
  SignIn: lazy(() => import("./screens/auth/SignIn").then(module => ({ default: module.SignIn }))),
  SignUp: lazy(() => import("./screens/auth/SignUp").then(module => ({ default: module.SignUp }))),
  ForgotPassword: lazy(() => import("./screens/auth/ForgotPassword").then(module => ({ default: module.ForgotPassword }))),
  ResetPassword: lazy(() => import("./screens/auth/ResetPassword").then(module => ({ default: module.ResetPassword }))),
  VerifyEmail: lazy(() => import("./screens/auth/VerifyEmail").then(module => ({ default: module.VerifyEmail }))),
  SessionExpired: lazy(() => import("./screens/auth/SessionExpired").then(module => ({ default: module.SessionExpired }))),
  GuestWelcome: lazy(() => import("./screens/guest/GuestWelcome").then(module => ({ default: module.GuestWelcome }))),
  GuestForm: lazy(() => import("./screens/guest/GuestForm").then(module => ({ default: module.GuestForm }))),
  GuestVerify: lazy(() => import("./screens/guest/GuestVerify").then(module => ({ default: module.GuestVerify }))),
  GuestSuccess: lazy(() => import("./screens/guest/GuestSuccess").then(module => ({ default: module.GuestSuccess }))),
  NotFound: lazy(() => import("./screens/errors/NotFound").then(module => ({ default: module.NotFound }))),
  ServerError: lazy(() => import("./screens/errors/ServerError").then(module => ({ default: module.ServerError }))),
};

function Router() {
  const { route } = useApp();
  const [name, title] = resolveRoute(route.path);
  const Screen = SCREENS[name];
  useEffect(() => { document.title = title === "Finchbound" ? title : title + " | Finchbound"; }, [title]);
  return <>
    <Suspense fallback={<div role="status" className="flex min-h-dvh items-center justify-center bg-nest text-slate">Loading...</div>}>
      <Screen key={route.path.join("/") + (route.query.get("variant") ?? "")} />
    </Suspense>
    <Toaster />
  </>;
}

export default function App() {
  return <AppProvider><Router /></AppProvider>;
}
