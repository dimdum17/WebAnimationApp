import { useRef, useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Minus, X, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '@/state/store';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/controls';
import { useAsset } from '@/hooks/useAsset';
import { addFilesToSlots, loadSampleImages } from '@/state/media';
import { makeSlots } from '@/state/defaults';
import { MAX_SLOTS, type Slot } from '@/types/project';

function SlotRow({ slot, index }: { slot: Slot; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const { asset, failed } = useAsset(slot.assetId);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const edit = useStore((s) => s.edit);

  const add = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    await addFilesToSlots(files, index);
    setBusy(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl border bg-panel-2/60 p-1.5 pr-2 ${
        over ? 'border-accent bg-accent/10' : 'border-line'
      } ${isDragging ? 'z-10 opacity-80 shadow-lg' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        void add([...e.dataTransfer.files]);
      }}
    >
      <button
        type="button"
        aria-label={`Reorder slot ${index + 1}`}
        className="cursor-grab touch-none text-faint hover:text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={`Choose image for slot ${index + 1}`}
        className="flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-panel-3 text-faint hover:border-line-strong hover:text-muted"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : asset ? (
          <img src={asset.url} alt="" className="h-full w-full object-cover" />
        ) : failed ? (
          <AlertTriangle size={14} className="text-amber-500" />
        ) : (
          <Plus size={14} />
        )}
      </button>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-xs font-medium">Slot {index + 1}</div>
        <div className="truncate text-[11px] text-faint">
          {failed ? 'Image could not be loaded' : asset ? `${asset.width} × ${asset.height}` : 'Drop or click to add'}
        </div>
      </div>
      {slot.assetId && (
        <button
          type="button"
          aria-label={`Remove image from slot ${index + 1}`}
          onClick={() => edit((d) => void (d.slots[index].assetId = null))}
          className="rounded-md p-1 text-faint hover:bg-panel-3 hover:text-fg"
        >
          <X size={13} />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void add([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function MediaSection() {
  const slots = useStore((s) => s.project.slots);
  const edit = useStore((s) => s.edit);
  const [loading, setLoading] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setCount = (n: number) =>
    edit((d) => {
      const target = Math.max(1, Math.min(MAX_SLOTS, n));
      if (target > d.slots.length) d.slots.push(...makeSlots(target - d.slots.length));
      else d.slots = d.slots.slice(0, target);
    });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    edit((d) => {
      const from = d.slots.findIndex((s) => s.id === active.id);
      const to = d.slots.findIndex((s) => s.id === over.id);
      d.slots = arrayMove(d.slots, from, to);
    });
  };

  const hasImages = slots.some((s) => s.assetId);

  return (
    <Section id="media" title={`Media · ${slots.length} slots`}>
      <div className="flex items-center justify-between rounded-xl bg-panel-2/60 px-2.5 py-1.5">
        <span className="text-xs text-muted">Number of images</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Fewer slots"
            disabled={slots.length <= 1}
            onClick={() => setCount(slots.length - 1)}
            className="rounded-md p-1 text-muted hover:bg-panel-3 hover:text-fg disabled:opacity-30"
          >
            <Minus size={13} />
          </button>
          <span className="w-6 text-center font-mono text-xs tabular-nums">{slots.length}</span>
          <button
            type="button"
            aria-label="More slots"
            disabled={slots.length >= MAX_SLOTS}
            onClick={() => setCount(slots.length + 1)}
            className="rounded-md p-1 text-muted hover:bg-panel-3 hover:text-fg disabled:opacity-30"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={slots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {slots.map((s, i) => (
              <SlotRow key={s.id} slot={s} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await loadSampleImages();
            setLoading(false);
          }}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Sample images
        </Button>
        <Button
          className="flex-1"
          disabled={!hasImages}
          onClick={() => edit((d) => d.slots.forEach((s) => (s.assetId = null)))}
        >
          Clear images
        </Button>
      </div>
    </Section>
  );
}
