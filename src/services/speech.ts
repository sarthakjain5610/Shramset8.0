/**
 * Audio accessibility helper for WurkUp
 * Provides text-to-speech audio narration in Hindi or Indian English
 * for daily wage laborers, masons, and helpers.
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private isSpeaking: boolean = false;
  private listeners: ((speaking: boolean) => void)[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      // Pre-fetch voices when ready
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          // voices populated
        };
      }
    }
  }

  public subscribe(callback: (speaking: boolean) => void): () => void {
    this.listeners.push(callback);
    callback(this.isSpeaking);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify(speaking: boolean) {
    this.isSpeaking = speaking;
    const currentListeners = [...this.listeners];
    for (const cb of currentListeners) {
      try {
        cb(speaking);
      } catch (err) {
        console.warn('Speech listener error:', err);
      }
    }
  }

  public speak(text: string, lang: 'hi-IN' | 'en-IN' | 'en-US' = 'hi-IN'): void {
    if (!this.synth) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }

    // Cancel existing speech immediately
    try {
      this.synth.cancel();
    } catch {
      // ignore
    }

    const cleanText = text.replace(/[*_#]/g, '').trim();
    if (!cleanText) {
      this.notify(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    // Keep reference on instance to prevent Chromium garbage collection bug
    this.currentUtterance = utterance;

    utterance.rate = 0.95; // Slightly slower for clear comprehension
    utterance.pitch = 1.0;
    utterance.lang = lang;

    // Pick appropriate voice if available
    try {
      const voices = this.synth.getVoices();
      if (voices && voices.length > 0) {
        const langPrefix = lang.slice(0, 2);
        const targetVoice = voices.find((v) =>
          v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase()) ||
          v.lang.toLowerCase().startsWith(langPrefix.toLowerCase())
        );
        if (targetVoice) {
          utterance.voice = targetVoice;
        }
      }
    } catch {
      // fallback
    }

    utterance.onstart = () => {
      this.notify(true);
    };

    utterance.onend = () => {
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
      }
      this.notify(false);
    };

    utterance.onerror = (e) => {
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
      }
      this.notify(false);
    };

    // If synth was paused by the browser, resume it
    if (this.synth.paused) {
      try {
        this.synth.resume();
      } catch {
        // ignore
      }
    }

    // Small dispatch timeout avoids Chrome cancelling the newly queued utterance
    setTimeout(() => {
      if (this.synth && this.currentUtterance === utterance) {
        try {
          this.synth.speak(utterance);
          this.notify(true);
        } catch (err) {
          console.warn('SpeechSynthesis speak failed:', err);
          this.currentUtterance = null;
          this.notify(false);
        }
      }
    }, 15);
  }

  public stop(): void {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (err) {
        console.warn('SpeechSynthesis cancel error:', err);
      }
    }
    this.currentUtterance = null;
    this.notify(false);
  }

  public toggle(text: string, lang: 'hi-IN' | 'en-IN' | 'en-US' = 'hi-IN'): void {
    if (this.isSpeaking) {
      this.stop();
    } else {
      this.speak(text, lang);
    }
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const speech = new SpeechService();
