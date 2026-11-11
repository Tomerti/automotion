import type { Automaton } from '../../core/model';
import { parseFile } from '../../persistence/fileFormat';
import type { ParseResult } from '../../persistence/fileFormat';
import { looksLikeLatex, nameFromFile, parseLatex } from '../../persistence/latexImport';
import { appStore } from '../../store/store';
import { toast } from './toastStore';

/** What the Import button accepts: our JSON files and LaTeX (TikZ) files. */
export const IMPORT_ACCEPT = '.json,application/json,.tex,.tikz,application/x-tex,text/x-tex';

/** Whether a file dropped on the app is one Import takes: our JSON or LaTeX (TikZ). */
export function isImportable(name: string): boolean {
  return /\.(json|tex|tikz)$/i.test(name);
}

/** A `.tex` file, or anything else holding a tikzpicture, is LaTeX; the rest is our JSON. */
function parse(file: File, text: string, existing: Set<string>): ParseResult {
  const latex = /\.(tex|tikz)$/i.test(file.name) || (!/^\s*\{/.test(text) && looksLikeLatex(text));
  return latex ? parseLatex(text, nameFromFile(file.name)) : parseFile(text, existing);
}

/** Add parsed automata to the store (each opens as it is added); toast the outcome. */
function addParsed(result: ParseResult, done: (n: number) => string): void {
  if (!result.ok) {
    toast(result.error, 'error');
    return;
  }
  for (const a of result.automata) appStore.getState().addAutomaton(a);
  toast(done(result.automata.length));
}

const count = (n: number): string => (n === 1 ? '1 automaton' : `${n} automata`);

/** Read a file and add its automata to the store; toast the outcome. */
export async function importFile(file: File): Promise<void> {
  const text = await file.text();
  const existing = new Set(appStore.getState().automata.map((a: Automaton) => a.id));
  addParsed(parse(file, text, existing), (n) => `Imported ${count(n)}`);
}

/**
 * Add the automata of LaTeX pasted into the Paste LaTeX dialog. Returns the error to show in
 * the dialog, or `null` once they are added (and toasted).
 */
export function importLatexFromDialog(text: string): string | null {
  if (text.trim() === '') return 'Paste a tikzpicture first';
  const result = parseLatex(text, 'Pasted');
  // The parser's messages speak of a file; here the text was pasted.
  if (!result.ok) return result.error.replace('the LaTeX file', 'the pasted text');
  addParsed(result, (n) => `Added ${count(n)} from LaTeX`);
  return null;
}

/** Add the automata of pasted LaTeX (TikZ), named `name` unless the text names them. */
export function importLatexText(text: string, name: string): void {
  addParsed(parseLatex(text, name), (n) => `Pasted ${count(n)} from LaTeX`);
}
