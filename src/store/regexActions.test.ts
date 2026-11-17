import { beforeEach, describe, expect, it, vi } from 'vitest';
import { layoutInWorker } from '../layout/layoutClient';
import { fixture } from '../core/testing/fixtures';
import { createFromRegex } from './regexActions';
import { appStore, resetAppStore } from './store';
import { startRun } from './traceActions';

vi.mock('../layout/layoutClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../layout/layoutClient')>();
  return { ...real, layoutInWorker: vi.fn(real.layoutInWorker) };
});
const layoutMock = vi.mocked(layoutInWorker);

const seeded = fixture({
  name: 'Seeded',
  kind: 'DFA',
  alphabet: 'a',
  states: ['p'],
  start: 'p',
  accepting: ['p'],
  edges: [['p', 'a', 'p']],
});

beforeEach(() => resetAppStore({ automata: [seeded], activeId: seeded.id }));

const blank = fixture({ name: 'Untitled', kind: 'DFA', alphabet: '', states: [], edges: [] });

describe('createFromRegex', () => {
  it('fills the active empty automaton in place: no new history entry, one undo step', async () => {
    resetAppStore({ automata: [seeded, blank], activeId: blank.id });
    const id = await createFromRegex('(a|b)*abb');
    const st = appStore.getState();
    expect(id).toBe(blank.id);
    expect(st.automata).toHaveLength(2);
    expect(st.activeId).toBe(blank.id);
    const a = st.automata.find((x) => x.id === blank.id)!;
    expect(a.kind).toBe('DFA');
    expect(a.name).toBe('(a|b)*abb');
    expect(a.states).toHaveLength(4);
    expect(a.states.some((s) => s.x !== 0 || s.y !== 0)).toBe(true);
    st.undo();
    const back = appStore.getState().automata.find((x) => x.id === blank.id)!;
    expect(back.states).toHaveLength(0);
    expect(back.name).toBe('Untitled');
  });

  it("never fills a lesson's automaton: the DFA is added as a new one", async () => {
    resetAppStore({ automata: [seeded, blank], activeId: blank.id });
    appStore.getState().setLessonIds([blank.id]);
    const id = await createFromRegex('a');
    const st = appStore.getState();
    expect(id).not.toBe(blank.id);
    expect(st.automata).toHaveLength(3);
    expect(st.activeId).toBe(id);
    expect(st.automata.find((x) => x.id === blank.id)!.states).toHaveLength(0);
  });

  it('adds a new automaton when there is none to fill', async () => {
    resetAppStore({ automata: [], activeId: null });
    const id = await createFromRegex('a');
    const st = appStore.getState();
    expect(st.automata).toHaveLength(1);
    expect(st.activeId).toBe(id);
  });

  it('adds one minimal DFA named after the regex and opens it when the active one has states', async () => {
    const before = appStore.getState().automata.length;
    const id = await createFromRegex('(a|b)*abb');
    const st = appStore.getState();
    expect(st.automata).toHaveLength(before + 1);
    expect(st.activeId).toBe(id);
    const a = st.automata[0]!;
    expect(a.id).toBe(id);
    expect(a.kind).toBe('DFA');
    expect(a.name).toBe('(a|b)*abb');
    expect(a.states).toHaveLength(4);
    expect(a.states.some((s) => s.x !== 0 || s.y !== 0)).toBe(true);
  });

  it('does nothing for a refused regex', async () => {
    const before = appStore.getState().automata;
    expect(await createFromRegex('a|')).toBeNull();
    expect(appStore.getState().automata).toBe(before);
  });

  it('reports a layout failure through onError and adds nothing', async () => {
    const before = appStore.getState().automata;
    layoutMock.mockRejectedValueOnce(new Error('elk exploded'));
    const onError = vi.fn();
    expect(await createFromRegex('a', onError)).toBeNull();
    expect(onError).toHaveBeenCalledWith('Could not lay out the automaton');
    expect(appStore.getState().automata).toBe(before);
  });

  it('closes an open trace', async () => {
    startRun('a');
    expect(appStore.getState().trace).not.toBeNull();
    await createFromRegex('a');
    const st = appStore.getState();
    expect(st.trace).toBeNull();
    st.edit((a) => ({ ...a, name: 'Renamed' }));
    expect(appStore.getState().automata[0]?.name).toBe('Renamed');
  });

  it('is editable even when a lesson automaton was active', async () => {
    appStore.setState({ readOnly: [seeded.id] });
    const id = await createFromRegex('a');
    expect(id).not.toBeNull();
    expect(appStore.getState().readOnly).not.toContain(id);
    appStore.getState().edit((a) => ({ ...a, name: 'Renamed' }));
    expect(appStore.getState().automata[0]?.name).toBe('Renamed');
  });
});
