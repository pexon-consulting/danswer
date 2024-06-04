import { fetchSettingsSS } from "@/components/settings/lib";
import "./globals.css";

import { Inter } from "next/font/google";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
import IntlProvider from "@/components/IntlProvider";
import initTranslations from "@/app/i18n";
const i18nNamespaces = ["translation"];

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Danswer",
  description: "Question answering for your documents",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode,
  params: {
    locale: string;
  };
}) {
  const combinedSettings = await fetchSettingsSS();
  const { t, resources } = await initTranslations(locale, i18nNamespaces);

  return (
    <IntlProvider
      namespaces={i18nNamespaces}
      locale={locale}
      resources={resources}
    >
      <html lang="en">
        <body
          className={`${inter.variable} font-sans text-default bg-background ${
            // TODO: remove this once proper dark mode exists
            process.env.THEME_IS_DARK?.toLowerCase() === "true" ? "dark" : ""
          }`}
        >
          <SettingsProvider settings={combinedSettings}>
            {children}
          </SettingsProvider>
        </body>
      </html>
    </IntlProvider>
  );
}
