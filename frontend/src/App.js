import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { FiHome, FiUploadCloud, FiFolder, FiEdit3 } from 'react-icons/fi';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Review from './pages/Review';
import Requisitions from './pages/Requisitions';
import RequisitionDetail from './pages/RequisitionDetail';
import ManualInput from './pages/ManualInput';
import Income from './pages/Income';
import { FiDollarSign } from 'react-icons/fi';

function NavLink({ to, icon, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Nav.Link as={Link} to={to} className={isActive ? 'active' : ''}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {icon}<span>{children}</span>
    </Nav.Link>
  );
}

function App() {
  return (
    <Router>
      <Navbar expand="lg" className="app-navbar" sticky="top">
        <Container className="main-container" style={{ padding: '0 1.5rem' }}>
          <Navbar.Brand as={Link} to="/">
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg,#1a4d8f,#0ea5e9)',
              borderRadius: 6, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14,
            }}>IDP</div>
            <div>
              <div style={{ lineHeight: 1.2 }}>Requisition Portal</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>
                Intelligent Document Processing
              </div>
            </div>
          </Navbar.Brand>
          <Navbar.Toggle />
          <Navbar.Collapse>
            <Nav className="ms-auto">
              <NavLink to="/" icon={<FiHome size={16}/>}>Dashboard</NavLink>
              <NavLink to="/upload" icon={<FiUploadCloud size={16}/>}>Upload</NavLink>
              <NavLink to="/manual" icon={<FiEdit3 size={16} />}>Manual Input</NavLink>
              <NavLink to="/requisitions" icon={<FiFolder size={16}/>}>Requisitions</NavLink>
              <NavLink to="/income" icon={<FiDollarSign size={16} />}>Income</NavLink>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <div className="main-container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/manual" element={<ManualInput />} />
          <Route path="/review" element={<Review />} />
          <Route path="/requisitions" element={<Requisitions />} />
          <Route path="/requisitions/:id" element={<RequisitionDetail />} />
          <Route path="/income" element={<Income />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;