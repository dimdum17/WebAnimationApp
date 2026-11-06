import { ASPECTS, aspectRatio, type Aspect } from '@/types/project';
import { useStore } from '@/state/store';
import { Section } from '@/components/ui/Section';

export function FrameSection() {
  const aspect = useStore((s) => s.project.aspect);
  const edit = useStore((s) => s.edit);
  return (
    <Section id="frame" title="Frame" collapsible={false}>
      <div role="radiogroup" aria-label="Aspect ratio" className="grid grid-cols-6 gap-1 rounded-xl bg-panel-2 p-1">
        {ASPECTS.map((a: Aspect) => {
          const r = aspectRatio(a);
          const w = r >= 1 ? 18 : 18 * r;
          const h = r >= 1 ? 18 / r : 18;
          const on = a === aspect;
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Aspect ${a}`}
              onClick={() => edit((d) => void (d.aspect = a))}
              className={`flex flex-col items-center gap-1.5 rounded-lg py-2 transition ${
                on ? 'bg-panel-3 text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]' : 'text-faint hover:text-muted'
              }`}
            >
              <span className="flex h-[22px] items-center">
                <span className="block rounded-[3px] border-[1.5px] border-current" style={{ width: w, height: h }} />
              </span>
              <span className="text-[10px] font-medium">{a}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
