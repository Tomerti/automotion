import type { Automaton } from '../../core/model';
import { shareUrl } from '../../persistence/shareLink';
import { toast } from './toastStore';

/** Copy a link that opens a copy of the automaton (its content is in the URL's hash). */
export async function copyLink(a: Automaton): Promise<void> {
  try {
    const url = await shareUrl(a, location.origin + location.pathname);
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast('Could not copy the link', 'error');
  }
}
