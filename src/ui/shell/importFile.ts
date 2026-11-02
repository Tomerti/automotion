import { parseFile } from '../../persistence/fileFormat';
import type { ParseResult } from '../../persistence/fileFormat';
import { looksLikeLatex, nameFromFile, parseLatex } from '../../persistence/latexImport';
import { appStore } from '../../store/store';
import { toast } from './toastStore';

/** What the Import button accepts: our JSON files and LaTeX (TikZ) files. */
export const IMPORT_ACCEPT = '.json,application/json,.tex,.tikz,application/x-tex,text/x-tex';

/** A `.tex` file, or anything else holding a tikzpicture, is LaTeX; the rest is our JSON. */
function parse(file: File, text: string, existing: Set<string>): ParseResult {
  const latex = /\.(tex|tikz)$/i.test(file.name) || (!/^\s*\{/.test(text) && looksLikeLatex(text));
  return latex ? parseLatex(text, nameFromFile(file.name)) : parseFile(text, existing);
}

/** Read a file and add its automata to the store; toast the outcome. */
export async function importFile(file: File): Promise<void> {
  const text = await file.text();
  const existing = new Set(appStore.getState().automata.map((a) => a.id));
  const result = parse(file, text, existing);
  if (!result.ok) {
    toast(result.error, 'error');
    return;
  }
  for (const a of result.automata) appStore.getState().addAutomaton(a);
  const n = result.automata.length;
  toast(n === 1 ? 'Imported 1 automaton' : `Imported ${n} automata`);
}
