import { Canvas } from '../canvas/Canvas';
import { useAutosave } from '../../persistence/useAutosave';
import { AutomatonList } from './AutomatonList';
import { importFile } from './importFile';
import { RightPanel } from './RightPanel';
import { Toasts } from './Toasts';
import { Toolbar } from './Toolbar';
import './App.css';

export default function App(): React.JSX.Element {
  useAutosave();
  return (
    <div
      className="av-app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        for (const f of Array.from(e.dataTransfer.files)) {
          if (f.name.toLowerCase().endsWith('.json')) void importFile(f);
        }
      }}
    >
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
      <Toasts />
    </div>
  );
}
