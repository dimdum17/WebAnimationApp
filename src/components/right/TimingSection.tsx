import { useStore } from '@/state/store';
import { Section } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/controls';
import { Slider } from '@/components/ui/Slider';
import { MAX_DURATION, MIN_DURATION } from '@/types/project';
import { mod } from '@/lib/math';

const PRESETS = ['5', '10', '15', '20', '30'];

export function TimingSection() {
  const duration = useStore((s) => s.project.duration);
  const st = useStore.getState;
  const setDuration = (v: number) => {
    st().edit((d) => void (d.duration = v));
    st().setTime(mod(st().time, v));
  };
  return (
    <Section id="timing" title="Timing" collapsible={false}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">Loop duration</span>
        <span className="font-mono text-[11px] text-muted">{duration}s</span>
      </div>
      <Segmented
        label="Loop duration preset"
        value={PRESETS.includes(String(duration)) ? String(duration) : ''}
        options={PRESETS.map((p) => ({ value: p, label: `${p}s` }))}
        onChange={(v) => setDuration(Number(v))}
      />
      <Slider
        label="Loop duration"
        value={duration}
        min={MIN_DURATION}
        max={MAX_DURATION}
        step={1}
        onStart={() => st().beginGesture()}
        onEnd={() => st().endGesture()}
        onChange={setDuration}
      />
    </Section>
  );
}
