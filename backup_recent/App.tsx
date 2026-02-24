import { Layout } from './components/Layout';
// JobSelector removed
import { Timeline } from './components/Timeline';
import { MitigationGrid } from './components/MitigationGrid';

import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <Layout>
      <div className="flex flex-col h-screen pt-14">
        {/* Main Scrollable Container */}
        <div className="flex-1 overflow-auto relative flex">
          <ErrorBoundary>
            <Timeline />
          </ErrorBoundary>

          <ErrorBoundary>
            <MitigationGrid />
          </ErrorBoundary>


        </div>
      </div>
    </Layout>
  );
}

export default App;
