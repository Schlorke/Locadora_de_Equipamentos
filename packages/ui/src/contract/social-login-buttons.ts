import type { ReactNode } from "react";

export interface SocialLoginButtonsProps {
  onSignIn: (provider: "google" | "facebook", callbackUrl?: string) => Promise<void>;
  isLoading?: boolean;
  onError?: (error: string) => void;
  className?: string;
  variant?: "default" | "compact";
  callbackUrl?: string;
}

export interface SocialDividerProps {
  children?: ReactNode;
}
