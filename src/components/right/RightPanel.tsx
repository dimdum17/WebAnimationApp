import { FrameSection } from './FrameSection';
import { MediaSection } from './MediaSection';
import { TimingSection } from './TimingSection';
import { TextSection } from './TextSection';
import { LogoSection } from './LogoSection';
import { ShadowSection, TemplateSection } from './TemplateSection';

export function RightPanel() {
  return (
    <aside aria-label="Settings" className="scroll-thin flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel">
      <FrameSection />
      <MediaSection />
      <TimingSection />
      <TextSection />
      <LogoSection />
      <TemplateSection />
      <ShadowSection />
      <div className="h-10 shrink-0" />
    </aside>
  );
}
