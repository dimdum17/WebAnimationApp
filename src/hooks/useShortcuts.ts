import { useEffect } from 'react';
import { useStore } from '@/state/store';
import { deleteSelectedKey } from '@/components/stage/KeyframePanel';

function isEditable(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (st.exporting || document.querySelector('[aria-modal="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      // Native text undo stays with text fields.
      if (mod && (key === 'z' || key === 'y')) {
        if (isEditable(e.target)) return;
        e.preventDefault();
        if (key === 'y' || e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      const onSlider = e.target instanceof HTMLElement && e.target.getAttribute('role') === 'slider';
      if (isEditable(e.target) || mod || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        st.setPlaying(!st.playing);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (deleteSelectedKey()) e.preventDefault();
      } else if (key === 'k') {
        st.set({ keyframesOpen: !st.keyframesOpen });
      } else if (e.key === 'Home' && !onSlider) {
        st.setTime(0);
      } else if (e.key === 'Escape') {
        st.set({ selectedKey: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
