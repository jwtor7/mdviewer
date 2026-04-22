import React, { useEffect, useMemo, useState } from 'react';
import { TTS_RATE_BOUNDS } from '../hooks/useTTSPreferences';

export interface ReadAloudVoice {
  name: string;
  language: string;
  sampleText: string;
}

export interface ReadAloudChapter {
  index: number;
  title: string;
}

export interface ReadAloudMenuProps {
  voice: string;
  rate: number;
  onVoiceChange: (voice: string) => void;
  onRateChange: (rate: number) => void;
  onTestVoice: () => void;
  chapters?: ReadAloudChapter[];
  onSelectChapter?: (chapterIndex: number) => void;
  canReadFromCursor?: boolean;
  onReadFromCursor?: () => void;
}

const languageLabel = (code: string): string => {
  const [lang, region] = code.split('_');
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang);
    return region ? `${display ?? lang} (${region})` : (display ?? lang);
  } catch {
    return code;
  }
};

export const ReadAloudMenu: React.FC<ReadAloudMenuProps> = ({
  voice,
  rate,
  onVoiceChange,
  onRateChange,
  onTestVoice,
  chapters = [],
  onSelectChapter,
  canReadFromCursor = false,
  onReadFromCursor,
}) => {
  const [voices, setVoices] = useState<ReadAloudVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = window.electronAPI;
    if (!api?.listVoices) {
      setLoading(false);
      return () => { /* nothing to clean up */ };
    }
    setLoading(true);
    api.listVoices()
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setVoices(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to load voices');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load voices';
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, ReadAloudVoice[]>();
    for (const v of voices) {
      const list = groups.get(v.language) ?? [];
      list.push(v);
      groups.set(v.language, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [voices]);

  return (
    <div className="read-aloud-menu" role="menu" aria-label="Text-to-speech settings">
      <div className="read-aloud-menu-row">
        <label htmlFor="read-aloud-voice">Voice</label>
        <select
          id="read-aloud-voice"
          value={voice}
          onChange={(e) => onVoiceChange(e.target.value)}
          disabled={loading}
        >
          <option value="">System default</option>
          {grouped.map(([language, groupVoices]) => (
            <optgroup key={language} label={languageLabel(language)}>
              {groupVoices.map((v) => (
                <option key={`${v.language}-${v.name}`} value={v.name}>
                  {v.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {error && <span className="read-aloud-menu-error" role="alert">{error}</span>}
      </div>
      <div className="read-aloud-menu-row">
        <label htmlFor="read-aloud-rate">
          Rate <span className="read-aloud-rate-value">{rate}</span>
          <span className="read-aloud-rate-unit"> wpm</span>
        </label>
        <input
          id="read-aloud-rate"
          type="range"
          min={TTS_RATE_BOUNDS.MIN}
          max={TTS_RATE_BOUNDS.MAX}
          step={10}
          value={rate}
          onChange={(e) => onRateChange(Number(e.target.value))}
        />
      </div>
      <div className="read-aloud-menu-row read-aloud-menu-actions">
        <button
          type="button"
          className="read-aloud-test-btn"
          onClick={onTestVoice}
        >
          Test voice
        </button>
        {onReadFromCursor && (
          <button
            type="button"
            className="read-aloud-test-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onReadFromCursor}
            disabled={!canReadFromCursor}
            title={canReadFromCursor ? 'Read from the current cursor position (Cmd+Opt+Shift+R)' : 'Switch to Raw or Split view to read from cursor'}
          >
            Read from cursor
          </button>
        )}
      </div>
      {chapters.length > 0 && onSelectChapter && (
        <div className="read-aloud-menu-row read-aloud-chapters">
          <label>Chapters</label>
          <div className="read-aloud-chapter-list" role="list">
            {chapters.map((ch) => (
              <button
                key={ch.index}
                type="button"
                className="read-aloud-chapter-item"
                onClick={() => onSelectChapter(ch.index)}
                role="listitem"
              >
                {ch.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadAloudMenu;
