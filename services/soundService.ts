/**
 * Sound Service - Quản lý âm thanh thông báo
 */

// Âm thanh chuông mặc định (base64 encoded MP3)
const DEFAULT_BELL_SOUND = 'data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

class SoundService {
  private audio: HTMLAudioElement | null = null;
  private isEnabled: boolean = true;

  constructor() {
    try {
      this.isEnabled = localStorage.getItem('reminder_sound_enabled') !== 'false';
    } catch {
      this.isEnabled = true;
    }
  }

  /**
   * Phát âm thanh chuông thông báo
   */
  play = (): void => {
    if (!this.isEnabled) return;

    try {
      if (!this.audio) {
        this.audio = new Audio(DEFAULT_BELL_SOUND);
        this.audio.volume = 0.7;
      }

      // Reset và phát
      this.audio.currentTime = 0;
      this.audio.play().catch(err => {
        console.warn('Could not play sound:', err);
      });
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  /**
   * Phát âm thanh lặp lại nhiều lần
   */
  playRepeat = (times: number = 3, interval: number = 500): void => {
    if (!this.isEnabled) return;

    let count = 0;
    const playInterval = setInterval(() => {
      this.play();
      count++;
      if (count >= times) {
        clearInterval(playInterval);
      }
    }, interval);
  };

  /**
   * Bật âm thanh
   */
  enable = (): void => {
    this.isEnabled = true;
    try {
      localStorage.setItem('reminder_sound_enabled', 'true');
    } catch { }
  };

  /**
   * Tắt âm thanh
   */
  disable = (): void => {
    this.isEnabled = false;
    try {
      localStorage.setItem('reminder_sound_enabled', 'false');
    } catch { }
  };

  /**
   * Kiểm tra đang bật hay tắt
   */
  isEnabledState = (): boolean => {
    return this.isEnabled;
  };

  /**
   * Toggle bật/tắt
   */
  toggle = (): boolean => {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.isEnabled;
  };
}

// Export singleton instance
export const soundService = new SoundService();
