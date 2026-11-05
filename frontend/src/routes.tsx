// Address → page. Every page except Log in sits inside the Layout (menu + top bar).
import type { RouteObject } from 'react-router';

import Layout from './components/Layout';
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

export const routes: RouteObject[] = [
  { path: '/login', element: <Login /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> }, // "/"
      { path: 'sale', element: <Sale /> },
      { path: 'receive', element: <Receive /> },
      { path: 'stock', element: <Stock /> },
      { path: 'items', element: <Items /> },
      { path: 'sales', element: <SalesRecords /> },
      { path: 'restock', element: <Restock /> },
      { path: 'users', element: <Users /> },
      { path: '*', element: <NotFound /> }, // anything else
    ],
  },
];
