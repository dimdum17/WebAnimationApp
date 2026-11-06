import { useEffect } from 'react';
import { useStore } from '@/state/store';
import { bootPersistence } from '@/state/persist';
import { useShortcuts } from '@/hooks/useShortcuts';
import { Header } from '@/components/Header';
import { LeftPanel } from '@/components/left/LeftPanel';
import { RightPanel } from '@/components/right/RightPanel';
import { Stage } from '@/components/stage/Stage';
import { Timeline } from '@/components/stage/Timeline';
import { KeyframePanel } from '@/components/stage/KeyframePanel';
import { ExportDialog } from '@/components/ExportDialog';
import { ProjectsDialog } from '@/components/ProjectsDialog';
import { Toasts } from '@/components/Toasts';

export default function App() {
  const theme = useStore((s) => s.theme);
  const keyframesOpen = useStore((s) => s.keyframesOpen);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem('gk-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    document.title = 'Gerakinaja — Animated showcase editor';
    void bootPersistence();
  }, []);

  useShortcuts();

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg text-fg">
      <Header />
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <main className="flex min-w-0 flex-1 flex-col">
          <Stage />
          <Timeline />
          {keyframesOpen && <KeyframePanel />}
        </main>
        <RightPanel />
      </div>
      <ExportDialog />
      <ProjectsDialog />
      <Toasts />
    </div>
  );
}
