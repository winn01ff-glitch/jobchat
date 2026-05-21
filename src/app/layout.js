import '../styles/index.css';
import '../styles/landing.css';
import '../styles/form.css';
import '../styles/chat.css';
import '../styles/admin.css';
import '../styles/jobs.css';
import { LanguageProvider } from '../context/LanguageContext';
import { NotificationProvider } from '../context/NotificationContext';
import SupabaseProvider from '../context/SupabaseProvider';
import Header from '../components/Header';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'vietnamese'], weight: ['300', '400', '500', '600', '700', '800'] });

export const metadata = {
  title: "QuanLyTuyenDung",
  description: "Job Recruitment Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={inter.className}>
      <body>
        <LanguageProvider>
          <NotificationProvider>
            <SupabaseProvider>
              <div id="app">
                <Header />
                <main id="page-container">
                  {children}
                </main>
              </div>
            </SupabaseProvider>
          </NotificationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

