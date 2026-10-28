import { parseFile } from '../../persistence/fileFormat';
import { appStore } from '../../store/store';
import { toast } from './toastStore';

/** Read a file and add its automata to the store; toast the outcome. */
export async function importFile(file: File): Promise<void> {
  const text = await file.text();
  const existing = new Set(appStore.getState().automata.map((a) => a.id));
  const result = parseFile(text, existing);
  if (!result.ok) {
    toast(result.error, 'error');
    return;
  }
  for (const a of result.automata) appStore.getState().addAutomaton(a);
  const n = result.automata.length;
  toast(n === 1 ? 'Imported 1 automaton' : `Imported ${n} automata`);
}
