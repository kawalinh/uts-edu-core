import React from 'react';
import { UTSProvider, useUTS } from './context/UTSContext';
import { GentelellaShell } from './components/layout/GentelellaShell';
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard';
import { TimetableBuilder } from './components/builder/TimetableBuilder';
import { MasterDataHub } from './components/master/MasterDataHub';
import { ChangeManagementHub } from './components/workflow/ChangeManagementHub';
import { SemesterAndExamsHub } from './components/planning/SemesterAndExamsHub';
import { ReportsAndIntegrationsHub } from './components/reports/ReportsAndIntegrationsHub';
import { MobileCompanionView } from './components/mobile/MobileCompanionView';
import { RbacArchitectureView } from './components/rbac/RbacArchitectureView';
import { SystemAdminHub } from './components/admin/SystemAdminHub';

const UTSRouter: React.FC = () => {
  const { activeNav } = useUTS();

  switch (activeNav) {
    case 'dashboard':
      return <ExecutiveDashboard />;
    case 'admin':
      return <SystemAdminHub />;
    case 'builder':
      return <TimetableBuilder />;
    case 'master':
      return <MasterDataHub />;
    case 'workflow':
      return <ChangeManagementHub />;
    case 'planning':
      return <SemesterAndExamsHub />;
    case 'reports':
      return <ReportsAndIntegrationsHub />;
    case 'mobile':
      return <MobileCompanionView />;
    case 'rbac':
      return <RbacArchitectureView />;
    default:
      return <ExecutiveDashboard />;
  }
};

export default function App() {
  return (
    <UTSProvider>
      <GentelellaShell>
        <UTSRouter />
      </GentelellaShell>
    </UTSProvider>
  );
}
