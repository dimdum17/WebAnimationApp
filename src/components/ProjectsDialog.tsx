import { useCallback, useEffect, useState } from 'react';
import { Copy, FolderOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/state/store';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/controls';
import { listProjectRecords, saveProjectRecord } from '@/persistence/db';
import { newProject, openProject, removeProject, saveNow } from '@/state/persist';
import { getTemplate } from '@/templates/registry';
import { uid } from '@/lib/id';
import type { ProjectRecord } from '@/types/project';

function when(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ProjectsDialog() {
  const open = useStore((s) => s.projectsOpen);
  const currentId = useStore((s) => s.project.id);
  const set = useStore((s) => s.set);
  const [records, setRecords] = useState<ProjectRecord[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRecords(await listProjectRecords());
    } catch {
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setConfirmId(null);
    setRecords(null);
    void saveNow().then(refresh);
  }, [open, refresh]);

  const close = () => set({ projectsOpen: false });

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Projects"
      width={560}
      footer={
        <>
          <span className="mr-auto text-[11px] text-faint">Saved in this browser only</span>
          <Button
            variant="primary"
            onClick={async () => {
              await newProject();
              close();
            }}
          >
            <Plus size={13} /> New project
          </Button>
        </>
      }
    >
      {!records ? (
        <div className="flex h-40 items-center justify-center text-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted">No saved projects yet.</p>
      ) : (
        <ul className="scroll-thin -mx-1 max-h-[56vh] space-y-1.5 overflow-y-auto px-1">
          {records.map(({ project: p, thumbnail }) => {
            const current = p.id === currentId;
            let tplName = '';
            try {
              tplName = getTemplate(p.templateId).name;
            } catch {
              /* unknown template */
            }
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border p-2 ${current ? 'border-accent/50 bg-accent/5' : 'border-line bg-panel-2/40'}`}
              >
                <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-panel-3">
                  {thumbnail && <img src={thumbnail} alt="" className="max-h-full max-w-full object-contain" />}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-medium">
                    {p.name}
                    {current && <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-accent">Open</span>}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-faint">
                    {tplName} · {p.aspect} · {when(p.updatedAt)}
                  </div>
                </div>
                {confirmId === p.id ? (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" onClick={() => setConfirmId(null)}>
                      Keep
                    </Button>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        await removeProject(p.id);
                        setConfirmId(null);
                        await refresh();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5">
                    {!current && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          await openProject(p);
                          close();
                        }}
                      >
                        <FolderOpen size={13} /> Open
                      </Button>
                    )}
                    <button
                      type="button"
                      aria-label={`Duplicate ${p.name}`}
                      title="Duplicate"
                      onClick={async () => {
                        const now = Date.now();
                        const copy = { ...structuredClone(p), id: uid('p_'), name: `${p.name} copy`, createdAt: now, updatedAt: now };
                        await saveProjectRecord({ project: copy, thumbnail });
                        await refresh();
                      }}
                      className="rounded-md p-2 text-muted hover:bg-panel-3 hover:text-fg"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${p.name}`}
                      title="Delete"
                      onClick={() => setConfirmId(p.id)}
                      className="rounded-md p-2 text-muted hover:bg-panel-3 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
