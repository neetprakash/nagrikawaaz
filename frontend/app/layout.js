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
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">{children}</main>
        <footer className="border-t bg-white text-center text-sm text-gray-500 py-4">
          Nagrik Awaaz — MVP demo. Not affiliated with the Election Commission of India or MyGov.
        </footer>
      </body>
    </html>
  );
}
