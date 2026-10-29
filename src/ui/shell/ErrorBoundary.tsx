import { Component } from 'react';
import { serialize } from '../../persistence/fileFormat';
import { appStore } from '../../store/store';
import { downloadText } from './download';

interface State {
  crashed: boolean;
}

export class ErrorBoundary extends Component<{ children: React.ReactNode }, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('AutoMotion crashed', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.crashed) return this.props.children;
    return (
      <div role="alert" className="av-crash">
        <h1>Something went wrong</h1>
        <p>Your work is saved in this browser. You can also export it before reloading.</p>
        <button
          type="button"
          onClick={() =>
            downloadText(
              'automata.automaton.json',
              serialize(appStore.getState().automata),
              'application/json',
            )
          }
        >
          Export your data
        </button>
        <button type="button" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
