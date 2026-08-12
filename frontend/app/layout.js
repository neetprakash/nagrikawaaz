import './globals.css';
import NavBar from '../components/NavBar';

export const metadata = {
  title: 'Nagrik Awaaz — Verified Citizen Accountability Platform',
  description: 'Ask your MP. Vote on real issues. Track official action. Genuine users only.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        <NavBar />
        {/* md+: leave room for the 240px sidebar. pb-20 on mobile keeps the
            last feed post above the fixed bottom tab bar. */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 md:pl-60 pb-20 md:pb-6">
          {children}
        </main>
        <footer className="border-t bg-white text-center text-sm text-gray-500 py-4 md:pl-60">
          Nagrik Awaaz — MVP demo. Not affiliated with the Election Commission of India or MyGov.
        </footer>
      </body>
    </html>
  );
}
