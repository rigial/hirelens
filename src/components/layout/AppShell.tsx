import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100 transition-colors select-none">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 p-6 overflow-hidden max-w-7xl mx-auto w-full flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
