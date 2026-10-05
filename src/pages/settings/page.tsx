import { useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils.ts';

type ToggleProps = { on: boolean; onChange: (v: boolean) => void };

function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        'relative rounded-full transition-colors cursor-pointer',
        on ? 'bg-primary' : 'bg-muted'
      )}
      style={{ width: '40px', height: '22px' }}
    >
      <div
        className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-3 mb-3 bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [highAccuracy, setHighAccuracy] = useState(
    () => localStorage.getItem('s_highAccuracy') !== 'false'
  );
  const [autoSave, setAutoSave] = useState(
    () => localStorage.getItem('s_autoSave') !== 'false'
  );
  const [showAlt, setShowAlt] = useState(
    () => localStorage.getItem('s_showAlt') !== 'false'
  );
  const [gpsOverlay, setGpsOverlay] = useState(
    () => localStorage.getItem('s_gpsOverlay') !== 'false'
  );

  const save = (key: string, val: boolean, setter: (v: boolean) => void) => {
    localStorage.setItem(key, String(val));
    setter(val);
  };

  return (
    <div className="overflow-y-auto h-full py-3">
      <Group title="📍 GPS & Location">
        <Row label="High Accuracy GPS" desc="More precise, uses more battery">
          <Toggle on={highAccuracy} onChange={(v) => save('s_highAccuracy', v, setHighAccuracy)} />
        </Row>
        <Row label="Show Altitude" desc="Display altitude on stamp">
          <Toggle on={showAlt} onChange={(v) => save('s_showAlt', v, setShowAlt)} />
        </Row>
        <Row label="GPS Overlay" desc="Live coordinates on viewfinder">
          <Toggle on={gpsOverlay} onChange={(v) => save('s_gpsOverlay', v, setGpsOverlay)} />
        </Row>
      </Group>

      <Group title="📷 Camera">
        <Row label="Auto-Save" desc="Save all captures automatically">
          <Toggle on={autoSave} onChange={(v) => save('s_autoSave', v, setAutoSave)} />
        </Row>
      </Group>

      <Group title="🎨 Appearance">
        <Row label="Theme">
          <div className="flex gap-1">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer capitalize transition-colors',
                  theme === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </Row>
      </Group>

      <Group title="ℹ️ App Info">
        <Row label="Version">
          <span className="text-sm text-muted-foreground">1.0.0</span>
        </Row>
        <Row label="Build">
          <span className="text-sm text-muted-foreground">ES OneWorld</span>
        </Row>
        <Row label="Recovery HTML">
          <a
            href="/es-gps-cam-recovery.html"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-primary font-semibold cursor-pointer"
          >
            Open →
          </a>
        </Row>
      </Group>
    </div>
  );
}
