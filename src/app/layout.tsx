import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TitleUpdater } from "@/components/pc/title-updater";
import { FaviconUpdater } from "@/components/pc/favicon-updater";
import { ThemeInit } from "@/components/pc/theme-init";
import { GlobalSearchShortcut } from "@/components/pc/global-search-shortcut";
import { getSiteConfig, formatTitle } from "@/lib/site-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: "normal",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription, siteKeywords, siteUrl, ogImage, ogType, twitterCard } = await getSiteConfig();
  const title = formatTitle('摄影作品展示平台', siteName);
  const keywords = siteKeywords.split(',').map(k => k.trim()).filter(Boolean);

  return {
    title: {
      default: title,
      template: `%s - ${siteName}`,
    },
    description: siteDescription,
    keywords,
    authors: [{ name: siteName }],
    ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
    openGraph: {
      title,
      description: siteDescription,
      type: (ogType === 'website' || ogType === 'article' ? ogType : 'website') as 'website' | 'article',
      siteName,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: twitterCard as 'summary' | 'summary_large_image',
      title,
      description: siteDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

const INLINE_SCRIPT_TITLE = "try{var t=localStorage.getItem('site_title_cache');if(t)document.title=t}catch(e){}";
const INLINE_SCRIPT_FAVICON = "try{var f=localStorage.getItem('site_favicon_cache');if(f){var l=document.createElement('link');l.rel='icon';l.type='image/png';l.href=f;l.setAttribute('data-dynamic-favicon','true');document.head.appendChild(l)}}catch(e){}";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: INLINE_SCRIPT_TITLE,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: INLINE_SCRIPT_FAVICON,
          }}
        />
        <link rel="icon" href="/logo.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerifSC.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeInit />
          <TitleUpdater />
          <FaviconUpdater />
          <GlobalSearchShortcut />
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              className: "glass-strong",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
