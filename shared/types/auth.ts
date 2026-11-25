export type UserRole = "host" | "admin";
export type SessionUser = { id: string; name: string; email: string; plan: string; role: UserRole };

export type SignInRequest = { email: string; password: string; remember: boolean };
export type SignInResponse = { user: SessionUser };

export type SignUpRequest = { name: string; email: string; password: string };
export type SignUpResponse = { email: string };

export type VerifyEmailRequest = { email: string; code: string };
export type VerifyEmailResponse = { user: SessionUser };

export type ResendCodeRequest = { email: string };
export type ForgotPasswordRequest = { email: string };
export type ResetPasswordRequest = { token: string; password: string };
export type OkResponse = { ok: true };
