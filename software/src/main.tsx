import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import Landing from './Landing';
import { useLocation } from 'react-router-dom';
function Website() { const location = useLocation(); const publicPage = ['/', '/nuestro-origen', '/el-cafe', '/proceso-del-cafe', '/productores', '/visitanos', '/contacto'].includes(location.pathname); React.useEffect(() => { if (!publicPage) document.title = 'Chasquero Coffee | Gestión'; }, [publicPage, location.pathname]); return publicPage ? <Landing/> : <App/>; }
import './styles.css';
import './coffee-theme.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Website/></BrowserRouter></React.StrictMode>);
