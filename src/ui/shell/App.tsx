import { Canvas } from '../canvas/Canvas';
import { AutomatonList } from './AutomatonList';
import { RightPanel } from './RightPanel';
import { Toolbar } from './Toolbar';
import './App.css';

export default function App(): React.JSX.Element {
  return (
    <div className="av-app">
      <aside className="av-sidebar">
        <h1>Automaton Vis</h1>
        <AutomatonList />
      </aside>
      <header className="av-toolbar-area">
        <Toolbar />
      </header>
      <main className="av-canvas-area">
        <Canvas />
      </main>
      <aside className="av-right" data-testid="right-panel">
        <RightPanel />
      </aside>
      <section className="av-bottom" data-testid="bottom-panel" />
    </div>
  );
}
