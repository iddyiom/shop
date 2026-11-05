// Address → page.
//   AuthRoot      knows who is logged in (all pages)
//   RequireAuth   no user → /login
//   Layout        menu + top bar
//   RequireOwner  shopkeeper → "Owner only" page
import { Outlet, type RouteObject } from 'react-router';

import { AuthProvider } from './auth';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import RequireOwner from './components/RequireOwner';
import Home from './pages/Home';
import Items from './pages/Items';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Receive from './pages/Receive';
import Restock from './pages/Restock';
import Sale from './pages/Sale';
import SalesRecords from './pages/SalesRecords';
import Stock from './pages/Stock';
import Users from './pages/Users';

function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const routes: RouteObject[] = [
  {
    element: <AuthRoot />,
    children: [
      { path: '/login', element: <Login /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <Layout />,
            children: [
              { index: true, element: <Home /> }, // "/"
              { path: 'sale', element: <Sale /> },
              { path: 'receive', element: <Receive /> },
              { path: 'stock', element: <Stock /> },
              { path: 'sales', element: <SalesRecords /> },
              { path: 'restock', element: <Restock /> },
              {
                element: <RequireOwner />,
                children: [
                  { path: 'items', element: <Items /> },
                  { path: 'users', element: <Users /> },
                ],
              },
              { path: '*', element: <NotFound /> }, // anything else
            ],
          },
        ],
      },
    ],
  },
];
