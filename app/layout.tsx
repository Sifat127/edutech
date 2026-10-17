import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { LmsProvider } from '@/components/lms-provider';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'DIU EduTech',
  description:
    'A modern online learning platform for structured free and paid courses powered by YouTube Unlisted video lessons, Firebase Authentication, and Cloud Firestore.',
  openGraph: {
    title: 'DIU EduTech',
    description:
      'A modern online learning platform for structured free and paid courses powered by YouTube Unlisted video lessons, Firebase Authentication, and Cloud Firestore.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DIU EduTech',
    description:
      'A modern online learning platform for structured free and paid courses powered by YouTube Unlisted video lessons, Firebase Authentication, and Cloud Firestore.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fetchGuardScript = `(function(){try{var f=window.fetch;if(typeof f==='function'){Object.defineProperty(window,'fetch',{configurable:true,enumerable:true,get:function(){return f;},set:function(v){if(typeof v==='function')f=v;}});}if(typeof Window!=='undefined'&&Window.prototype){var d=Object.getOwnPropertyDescriptor(Window.prototype,'fetch');if(d&&d.get&&!d.set){Object.defineProperty(Window.prototype,'fetch',{configurable:true,enumerable:d.enumerable,get:function(){return f||d.get.call(this);},set:function(v){if(typeof v==='function')f=v;}});}}}catch(e){}window.addEventListener('error',function(ev){var m=(ev&&ev.message)||'';var fn=(ev&&ev.filename)||'';if(m.indexOf('Cannot set property fetch')!==-1||fn.indexOf('chrome-extension://')===0||fn.indexOf('moz-extension://')===0){ev.stopImmediatePropagation();ev.preventDefault();return false;}},true);window.addEventListener('unhandledrejection',function(ev){var r=ev&&ev.reason;var m=(r&&(r.message||String(r)))||'';var s=(r&&r.stack)||'';if(m.indexOf('Cannot set property fetch')!==-1||s.indexOf('chrome-extension://')!==-1){ev.stopImmediatePropagation();ev.preventDefault();return false;}},true);})();`;

  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <script dangerouslySetInnerHTML={{ __html: fetchGuardScript }} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900"
      >
        <LmsProvider>{children}</LmsProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
