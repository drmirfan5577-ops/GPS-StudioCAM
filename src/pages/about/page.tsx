import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const CARDS = [
  {
    title: '📱 About ES GPS CAM',
    body: 'ES GPS CAM is a professional GPS/GPX location-aware camera app — a project of ES OneWorld. Built as a Progressive Web App (PWA), it works entirely in your browser with no downloads required.\n\nFeatures: Real-time GPS stamp overlay · Google-style stamp with satellite map thumbnail · GPX route tracking & export · UHD 4K capture · 6 aspect ratios · Beauty filters · Movie Studio · Media Player · Full offline support.',
  },
  {
    title: '🎯 Vision & Mission',
    body: "Vision: To be the world's most trusted open-platform GPS camera application.\n\nMission: We believe accurate location documentation should be accessible to everyone. ES GPS CAM is built with privacy first — all your media and location data stays entirely on your device. No servers. No tracking. No subscriptions.",
  },
  {
    title: '⚠️ Disclaimer',
    body: 'ES GPS CAM is provided "as is" without warranty of any kind. GPS accuracy depends on device hardware, environment, and network conditions.\n\nDo NOT use for emergency navigation, aviation, maritime operations, or any safety-critical purpose.\n\nUsers are solely responsible for complying with all applicable local photography, recording, and privacy laws. ES OneWorld accepts no liability for inaccuracies, data loss, or any damages arising from use of this app.',
  },
  {
    title: '🔒 Privacy Policy',
    body: 'ES GPS CAM is 100% private:\n\n• All photos and videos are stored on your device only\n• Location data is never transmitted to any server\n• No analytics, no tracking, no advertising\n• No account required\n• Reverse geocoding uses OpenStreetMap Nominatim (standard HTTP request, no personal data logged)\n• Map tiles are loaded from public tile servers',
  },
  {
    title: '📜 Terms of Use',
    body: 'By using ES GPS CAM you agree to:\n1. Use only for lawful purposes\n2. Comply with all local photography and recording laws\n3. Not use for emergency navigation or safety-critical purposes\n4. Not reproduce ES OneWorld intellectual property without permission\n5. Acknowledge that no warranty is provided\n\nThese terms are governed by Pakistani law.',
  },
  {
    title: '©️ Copyright',
    body: `© ${new Date().getFullYear()} ES OneWorld. All Rights Reserved.\n\nES GPS CAM, ES OneWorld, and all associated branding, source code, design, and documentation are protected intellectual property. Unauthorized reproduction, modification, distribution, or commercial use is strictly prohibited without written permission from ES OneWorld.`,
  },
  {
    title: '🔑 Permissions Used',
    body: 'ES GPS CAM requests the following device permissions:\n\n📷 Camera — Required for photo and video capture\n📍 Location (GPS) — Required for GPS stamp and map features\n🎤 Microphone — Required for video recording with audio\n💾 Storage — Required to save media to gallery\n\nAll permissions are requested only when needed and can be revoked at any time in your browser settings.',
  },
  {
    title: '📞 Contact',
    body: 'General: info@esoneworld.com\nSupport: support@esoneworld.com\nPrivacy: privacy@esoneworld.com\nLegal: legal@esoneworld.com\n\nWebsite: www.esoneworld.com\n\nES OneWorld — Pakistan',
  },
];

function AboutCard({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-3 mb-2 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold cursor-pointer text-left"
      >
        <span>{title}</span>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed whitespace-pre-line border-t border-border pt-3">
          {body}
        </div>
      )}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="overflow-y-auto h-full">
      {/* Hero */}
      <div className="text-center px-4 py-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-3xl mx-auto mb-3">
          📍
        </div>
        <div className="text-xl font-black bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
          ES GPS CAM
        </div>
        <div className="text-xs text-muted-foreground mt-1">A project of ES OneWorld</div>
        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
          {[
            'GPS Enabled',
            'GPX Export',
            'PWA',
            '4K UHD',
            'Offline Ready',
            'Privacy First',
          ].map((t) => (
            <span
              key={t}
              className="bg-primary/10 border border-primary/20 text-primary rounded-full px-2 py-0.5 text-[9px] font-semibold"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {CARDS.map((c) => (
        <AboutCard key={c.title} {...c} />
      ))}

      <div className="text-center py-4 text-[10px] text-muted-foreground">
        © {new Date().getFullYear()} ES OneWorld. All Rights Reserved.
      </div>
    </div>
  );
}
