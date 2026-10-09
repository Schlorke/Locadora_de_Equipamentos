import { ActivityIndicator, Pressable, Text } from "react-native";
import type { ReactNode } from "react";
import { resolveCTAButtonStyle, type CTAButtonProps } from "../contract/cta-button";
import { useTheme } from "../theme/ThemeProvider";

export function CTAButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  testID,
}: CTAButtonProps) {
  const theme = useTheme();
  const s = resolveCTAButtonStyle(theme, variant, size, { disabled: disabled || loading });
  const label = typeof children === "string" || typeof children === "number" ? String(children) : undefined;
  const blocked = Boolean(disabled || loading);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked }}
      disabled={blocked}
      onPress={blocked ? undefined : () => void onClick?.()}
      style={({ pressed }) => ({
        backgroundColor: s.backgroundColor,
        borderColor: s.borderColor,
        borderWidth: s.borderWidth,
        opacity: pressed ? 0.85 : s.opacity,
        paddingVertical: s.paddingVertical,
        paddingHorizontal: s.paddingHorizontal,
        borderRadius: s.borderRadius,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: fullWidth ? "stretch" : "flex-start",
        width: fullWidth ? "100%" : undefined,
      })}
    >
      {loading ? (
        <ActivityIndicator color={s.color} />
      ) : (
        <Text style={{ color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight }}>{children as ReactNode}</Text>
      )}
    </Pressable>
  );
}

export const PrimaryCTA = (props: Omit<CTAButtonProps, "variant">) => <CTAButton variant="primary" {...props} />;

export const SecondaryCTA = (props: Omit<CTAButtonProps, "variant">) => <CTAButton variant="secondary" {...props} />;

export const OutlineCTA = (props: Omit<CTAButtonProps, "variant">) => <CTAButton variant="outline" {...props} />;

export const QuoteCTA = (props: Omit<CTAButtonProps, "children" | "trackingId">) => (
  <CTAButton trackingId="request-quote" {...props}>
    Solicitar Orçamento
  </CTAButton>
);

export const ContactCTA = (props: Omit<CTAButtonProps, "children" | "trackingId">) => (
  <CTAButton trackingId="contact-us" {...props}>
    Entrar em Contato
  </CTAButton>
);

export const PhoneCTA = ({
  phone,
  ...props
}: { phone: string } & Omit<CTAButtonProps, "children" | "href" | "trackingId">) => (
  <CTAButton href={`tel:${phone}`} trackingId="call-phone" {...props}>
    {phone}
  </CTAButton>
);

export const WhatsAppCTA = ({
  phone,
  message = "Olá! Gostaria de solicitar um orçamento.",
  ...props
}: {
  phone: string;
  message?: string;
} & Omit<CTAButtonProps, "children" | "href" | "trackingId" | "className">) => (
  <CTAButton
    href={`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`}
    trackingId="whatsapp-contact"
    {...props}
  >
    WhatsApp
  </CTAButton>
);
