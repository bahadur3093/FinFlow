import { Outlet, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/budgets', label: 'Budgets', icon: '◎' },
  { to: '/transactions', label: 'Txns', icon: '⇄' },
  { to: '/upload', label: 'Upload', icon: '↑' },
  { to: '/insights', label: 'AI', icon: '✦' },
];

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {navItems.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs gap-1 ${isActive ? 'text-brand font-medium' : 'text-gray-400'}`}>
            <span className="text-xl leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
