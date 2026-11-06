import { useEffect, useState } from 'react';
import { Download, FolderOpen, Moon, Redo2, Sun, Undo2 } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button, IconButton } from '@/components/ui/controls';

function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="3" y="7" width="12" height="15" rx="3" transform="rotate(-12 9 14.5)" className="fill-fg/25" />
      <rect x="8" y="4" width="12" height="15" rx="3" transform="rotate(8 14 11.5)" className="fill-accent" />
    </svg>
  );
}

function ProjectName() {
  const name = useStore((s) => s.project.name);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => {
    const v = draft.trim() || 'Untitled showcase';
    setDraft(v);
    if (v !== name) useStore.getState().edit((d) => void (d.name = v));
  };
  return (
    <input
      aria-label="Project name"
      value={draft}
      maxLength={80}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(name);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-8 w-[260px] truncate rounded-lg border border-transparent bg-transparent px-2.5 text-center text-[13px] font-medium text-fg outline-none hover:border-line focus:border-accent focus:bg-panel-2"
    />
  );
}

export function Header() {
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const theme = useStore((s) => s.theme);
  const st = useStore.getState;
  const mod = typeof navigator !== 'undefined' && /Mac|iP/.test(navigator.platform) ? '⌘' : 'Ctrl+';
  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-panel px-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 pl-1">
          <BrandMark />
          <span className="font-display text-[15px] font-semibold tracking-tight">Gerakinaja</span>
        </div>
        <div className="h-5 w-px bg-line" />
        <div className="flex items-center gap-0.5">
          <IconButton label={`Undo (${mod}Z)`} disabled={!canUndo} onClick={() => st().undo()}>
            <Undo2 size={15} />
          </IconButton>
          <IconButton label={`Redo (${mod}Shift+Z)`} disabled={!canRedo} onClick={() => st().redo()}>
            <Redo2 size={15} />
          </IconButton>
        </div>
      </div>
      <ProjectName />
      <div className="flex items-center justify-end gap-1.5">
        <Button variant="ghost" onClick={() => st().set({ projectsOpen: true })}>
          <FolderOpen size={14} /> Projects
        </Button>
        <IconButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => st().set({ theme: theme === 'dark' ? 'light' : 'dark' })}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </IconButton>
        <Button variant="primary" className="ml-1" onClick={() => st().set({ exportOpen: true })}>
          <Download size={14} /> Export
        </Button>
      </div>
    </header>
  );
}
